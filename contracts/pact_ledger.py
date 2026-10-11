# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *

ERROR_EXPECTED = "[EXPECTED]"
ERROR_LLM = "[LLM_ERROR]"

MAX_EVIDENCE_ENTRIES = 50
MAX_TEXT_LEN = 5000
MAX_REASON_LEN = 2000
MAX_NOTE_LEN = 2000
EVIDENCE_PAGE_LIMIT = 20


@gl.evm.contract_interface
class _EoaPayout:
    class View:
        pass

    class Write:
        pass


def _now() -> int:
    # Deterministic tx timestamp: identical for leader and validators.
    return int(datetime.now(timezone.utc).timestamp())


def _clean_json(text: str) -> dict:
    if not isinstance(text, str):
        raise gl.vm.UserError(f"{ERROR_LLM} LLM returned non-string: {type(text)}")
    cleaned = text.replace("```json", "").replace("```", "").strip()
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first < 0 or last <= first:
        raise gl.vm.UserError(f"{ERROR_LLM} No JSON object in LLM output")
    try:
        parsed = json.loads(cleaned[first : last + 1])
    except Exception as e:
        raise gl.vm.UserError(f"{ERROR_LLM} Unparsable LLM JSON: {e}")
    if not isinstance(parsed, dict):
        raise gl.vm.UserError(f"{ERROR_LLM} LLM JSON is not an object")
    return parsed


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        low = value.strip().lower()
        if low in ("true", "yes", "compliant", "pass", "passed", "1"):
            return True
        if low in ("false", "no", "breach", "breached", "fail", "failed", "0"):
            return False
    raise gl.vm.UserError(f"{ERROR_LLM} Non-boolean compliant flag: {value}")


def _parse_score(value) -> int:
    if value is None:
        raise gl.vm.UserError(f"{ERROR_LLM} Missing 'score' in LLM output")
    try:
        score = int(round(float(str(value).strip())))
    except (ValueError, TypeError):
        raise gl.vm.UserError(f"{ERROR_LLM} Non-numeric score: {value}")
    if score < 0:
        return 0
    if score > 100:
        return 100
    return score


def _norm_name(value) -> str:
    if value is None:
        return "none"
    return str(value).strip().lower()


def _participant_names(participants_json: str) -> list:
    try:
        items = json.loads(participants_json)
    except Exception:
        return []
    names = []
    for p in items:
        if isinstance(p, dict):
            n = str(p.get("name", "")).strip()
        else:
            n = str(p).strip()
        if n:
            names.append(n)
    return names


def _parse_agent_binding(entry: str):
    # Format "name=0xAddress". Returns (norm_name, display_name, Address).
    if "=" not in entry:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Participant must be name=0xAddress")
    name, _, addr = entry.partition("=")
    display = name.strip()
    key = _norm_name(display)
    addr = addr.strip()
    if not display or key in ("none", "unknown"):
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Participant name is empty or reserved")
    if len(addr) != 42 or not addr.startswith("0x"):
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Participant address malformed: {display}")
    try:
        int(addr[2:], 16)
    except Exception:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Participant address malformed: {display}")
    try:
        address = Address(addr)
    except Exception:
        raise gl.vm.UserError(f"{ERROR_EXPECTED} Participant address malformed: {display}")
    return key, display, address


MAX_FETCH_CHARS_PER_ENTRY = 1200
MAX_FETCH_CHARS_TOTAL = 8000


def _fetch_text(url: str) -> str:
    # Best-effort contract-side acquisition of submitted URL content.
    # Any failure yields a marker so the LLM falls back to the summary.
    # Validators run the same fetch independently; the decision-field
    # comparison in the validator absorbs availability variance.
    if not isinstance(url, str) or not url.strip():
        return ""
    try:
        res = gl.nondet.web.get(url.strip())
        body = res.body
        if isinstance(body, (bytes, bytearray)):
            text = bytes(body).decode("utf-8", errors="replace")
        else:
            text = str(body)
    except Exception:
        return "[content unavailable - judged by summary only]"
    text = " ".join(text.split())
    if len(text) > MAX_FETCH_CHARS_PER_ENTRY:
        text = text[:MAX_FETCH_CHARS_PER_ENTRY] + "…[truncated]"
    if not text.strip():
        return "[content unavailable - judged by summary only]"
    return text


def _build_evidence_text(entries: list) -> str:
    # Summaries for all entries plus fetched content within a total
    # budget. Deterministic budgeting; fetch success may vary per node.
    lines = []
    budget = MAX_FETCH_CHARS_TOTAL
    for e in entries:
        if not isinstance(e, dict):
            continue
        step_id = str(e.get("step_id", ""))
        agent = str(e.get("agent", ""))
        summary = str(e.get("summary", ""))
        submitted_at = e.get("submitted_at", "?")
        url = e.get("evidence_url", "")
        lines.append(f"- step {step_id} by {agent} (submitted_at={submitted_at}): {summary}")
        if budget > 0 and isinstance(url, str) and url.strip():
            content = _fetch_text(url)
            if content and not content.startswith("[content unavailable"):
                if len(content) > budget:
                    content = content[:budget] + "…[truncated]"
                budget -= len(content)
            lines.append(f"  fetched content: {content}")
    if not lines:
        return "[]"
    return "\n".join(lines)


def _handle_leader_error(leaders_res, leader_fn) -> bool:
    leader_msg = leaders_res.message if hasattr(leaders_res, "message") else ""
    try:
        leader_fn()
        return False
    except gl.vm.UserError as e:
        validator_msg = e.message if hasattr(e, "message") else str(e)
        if validator_msg.startswith(ERROR_EXPECTED):
            return validator_msg == leader_msg
        return False
    except Exception:
        return False


@allow_storage
@dataclass
class Workflow:
    workflow_id: str
    owner: Address
    description: str
    sla_criteria: str
    deadline_unix: u256
    participants_json: str
    penalty_atto: u256
    status: str
    evidence_count: u256
    beneficiary: Address
    escrowed: u256
    dispute_window_sec: u256
    verdict_time: u256
    settle_after: u256
    appeal_count: u256
    settled: bool
    dispute_note: str


@allow_storage
@dataclass
class Verdict:
    compliant: bool
    responsible_party: str
    score: u256
    penalty_applied_atto: u256
    reason: str


class PactLedger(gl.Contract):
    owner: Address
    workflows: TreeMap[str, Workflow]
    workflow_ids: DynArray[str]
    evidence: TreeMap[str, str]
    verdicts: TreeMap[str, Verdict]
    reputation: TreeMap[str, i64]
    # Flat agent bindings "workflow_id|agent_key" -> wallet hex. Plain str
    # values only: Address-typed map values do not round-trip on this runner.
    agent_bindings: TreeMap[str, str]

    def __init__(self):
        self.owner = gl.message.sender_address

    @gl.public.write
    def register_workflow(
        self,
        workflow_id: str,
        description: str,
        sla_criteria: str,
        deadline_unix: u256,
        participants: str,
        penalty_atto: u256,
        beneficiary: Address,
        dispute_window_sec: u256,
    ) -> None:
        wid = workflow_id.strip()
        if not wid:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} workflow_id is empty")
        if wid in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Workflow already exists")
        if not description.strip():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} description is empty")
        if not sla_criteria.strip():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} sla_criteria is empty")
        if len(description) > MAX_TEXT_LEN:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} description too long")
        if len(sla_criteria) > MAX_TEXT_LEN:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} sla_criteria too long")
        if deadline_unix <= u256(_now()):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} deadline must be in the future")
        # Comma-separated "name=0xAddress" bindings (no quotes needed).
        # The sender wallet must match the bound address to file evidence.
        # Stored canonically as JSON for the adjudication prompt.
        bound = {}
        display_names = []
        for raw in participants.split(","):
            raw = raw.strip()
            if not raw:
                continue
            key, display, address = _parse_agent_binding(raw)
            if key in bound:
                raise gl.vm.UserError(f"{ERROR_EXPECTED} Duplicate participant: {display}")
            bound[key] = address
            display_names.append(display)
        if len(bound) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} participants is empty")
        names = display_names
        participants_json = json.dumps(
            [{"name": n, "address": bound[_norm_name(n)].as_hex} for n in names]
        )

        self.workflows[wid] = Workflow(
            workflow_id=wid,
            owner=gl.message.sender_address,
            description=description,
            sla_criteria=sla_criteria,
            deadline_unix=deadline_unix,
            participants_json=participants_json,
            penalty_atto=penalty_atto,
            status="open",
            evidence_count=0,
            beneficiary=beneficiary,
            escrowed=u256(0),
            dispute_window_sec=dispute_window_sec,
            verdict_time=u256(0),
            settle_after=u256(0),
            appeal_count=u256(0),
            settled=False,
            dispute_note="",
        )
        self.workflow_ids.append(wid)
        for key, address in bound.items():
            self.agent_bindings[wid + "|" + key] = address.as_hex
            if key not in self.reputation:
                self.reputation[key] = 100

    @gl.public.write.payable
    def fund_workflow(self, workflow_id: str) -> dict:
        v = gl.message.value
        if v == u256(0):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} send some value")
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        if wf.owner != gl.message.sender_address:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only workflow owner can fund")
        if wf.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Workflow is not open for funding")
        wf.escrowed = wf.escrowed + v
        self.workflows[wid] = wf
        return {"workflow_id": wid, "escrowed_atto": str(wf.escrowed)}

    @gl.public.write
    def extend_deadline(self, workflow_id: str, new_deadline_unix: u256) -> dict:
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        if wf.owner != gl.message.sender_address:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only workflow owner can extend")
        if wf.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Workflow is not open")
        if new_deadline_unix <= wf.deadline_unix:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} New deadline must extend the current one")
        wf.deadline_unix = new_deadline_unix
        self.workflows[wid] = wf
        return {"workflow_id": wid, "deadline_unix": int(new_deadline_unix)}

    @gl.public.write
    def submit_evidence(
        self,
        workflow_id: str,
        step_id: str,
        agent_name: str,
        evidence_url: str,
        summary: str,
    ) -> None:
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        if wf.status not in ("open", "disputed"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Workflow is not accepting evidence")
        if not step_id.strip():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} step_id is empty")
        agent_key = _norm_name(agent_name)
        if not agent_key or agent_key in ("none", "unknown"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} agent_name is empty or reserved")
        binding_key = wid + "|" + agent_key
        bound_hex = ""
        if binding_key in self.agent_bindings:
            bound_hex = str(self.agent_bindings[binding_key]).lower()
        if not bound_hex or bound_hex != str(gl.message.sender_address.as_hex).lower():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Sender wallet is not bound to this participant")
        if not summary.strip():
            raise gl.vm.UserError(f"{ERROR_EXPECTED} summary is empty")
        if len(summary) > MAX_TEXT_LEN:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} summary too long")
        if len(evidence_url) > 2000:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} evidence_url too long")
        if int(wf.evidence_count) >= MAX_EVIDENCE_ENTRIES:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Evidence list is full")
        now = _now()
        if u256(now) > wf.deadline_unix and wf.status == "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Submission deadline has passed")
        if wid in self.evidence:
            try:
                prior = json.loads(self.evidence[wid])
            except Exception:
                prior = []
            for e in prior:
                if (
                    isinstance(e, dict)
                    and e.get("step_id") == step_id
                    and _norm_name(e.get("agent")) == _norm_name(agent_name)
                ):
                    raise gl.vm.UserError(f"{ERROR_EXPECTED} Duplicate submission for this step and agent")

        entry = {
            "step_id": step_id,
            "agent": agent_name.strip(),
            "evidence_url": evidence_url,
            "summary": summary,
            "submitted_at": now,
            "dispute_phase": bool(wf.status == "disputed"),
        }
        if wid in self.evidence:
            items = json.loads(self.evidence[wid])
            items.append(entry)
            self.evidence[wid] = json.dumps(items)
        else:
            self.evidence[wid] = json.dumps([entry])

        wf.evidence_count = wf.evidence_count + 1
        self.workflows[wid] = wf
        rep_key = _norm_name(agent_name)
        if rep_key and rep_key != "none" and rep_key not in self.reputation:
            self.reputation[rep_key] = 100

    def _adjudicate(self, workflow_id: str, dispute_note: str = "") -> dict:
        # Storage views cannot be read inside non-deterministic blocks
        # (see docs: storage), so copy everything needed into plain
        # in-memory locals first. The closures below only capture these.
        wf = gl.storage.copy_to_memory(self.workflows[workflow_id])
        description = str(wf.description)
        sla_criteria = str(wf.sla_criteria)
        deadline_unix = int(wf.deadline_unix)
        participants_json = str(wf.participants_json)
        try:
            entries = json.loads(str(self.evidence.get(workflow_id, "[]")))
        except Exception:
            entries = []
        if not isinstance(entries, list):
            entries = []
        note = dispute_note.strip()

        def leader_fn():
            # Evidence text (summaries + contract-side fetched URL content)
            # is built INSIDE the nondet block so validators independently
            # acquire the same source material.
            evidence_text = _build_evidence_text(entries)
            dispute_section = ""
            if note:
                dispute_section = f"""
Dispute raised by a workflow party (owner or beneficiary), re-adjudication requested:
{note}

Re-evaluate the verdict in light of this dispute. Uphold or overturn the
previous outcome based on the evidence and criteria.
"""
            prompt = f"""You are an SLA adjudicator for a multi-agent workflow.
Decide whether the delivered work meets the SLA and who is responsible if not.

Workflow description:
{description}

SLA criteria (authoritative):
{sla_criteria}

Submission deadline (unix seconds): {deadline_unix}
Each evidence entry carries its recorded submitted_at timestamp (unix seconds).
Judge lateness from those timestamps: delivery entries after the deadline do
not count. Entries flagged dispute_phase=true are counter-evidence submitted
during the dispute round: evaluate them on substance regardless of the deadline.
{dispute_section}
Participants:
{participants_json}

Submitted step evidence (summaries plus contract-fetched URL content):
{evidence_text}

Rules:
- compliant=true only if evidence shows ALL material SLA criteria are met.
- If any material criterion is missing or low quality, compliant=false.
- Consider only evidence entries submitted by listed participants; ignore entries from unknown agents.
- responsible_party must be one participant name from the list, or "none" if compliant.
- score is 0-100 overall SLA satisfaction (100 = fully met).
- If evidence is empty or missing ("[]"), compliant=false, score=0, responsible_party="unknown".

Respond ONLY in JSON:
{{"compliant": true/false, "responsible_party": str, "score": int, "reason": str}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(raw, dict):
                parsed = raw
            else:
                parsed = _clean_json(str(raw))
            compliant = _parse_bool(parsed.get("compliant"))
            score = _parse_score(parsed.get("score"))
            responsible = str(parsed.get("responsible_party", "none"))
            reason = str(parsed.get("reason", ""))
            if not reason.strip():
                raise gl.vm.UserError(f"{ERROR_LLM} Empty reason from LLM")
            return {
                "compliant": compliant,
                "responsible_party": responsible,
                "score": score,
                "reason": reason,
            }

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)
            try:
                v = leader_fn()
            except gl.vm.UserError as e:
                msg = e.message if hasattr(e, "message") else str(e)
                if msg.startswith(ERROR_EXPECTED):
                    return False
                return False
            except Exception:
                return False
            leader = leaders_res.calldata
            try:
                l_compliant = _parse_bool(leader.get("compliant"))
                l_score = _parse_score(leader.get("score"))
                l_resp = _norm_name(leader.get("responsible_party"))
            except gl.vm.UserError:
                return False
            if l_compliant != bool(v["compliant"]):
                return False
            if l_resp != _norm_name(v["responsible_party"]):
                return False
            # Gate (per docs quality-scoring pattern): rejection must be unanimous.
            if (int(v["score"]) == 0) != (int(l_score) == 0):
                return False
            if abs(int(v["score"]) - int(l_score)) > 15:
                return False
            return True

        return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

    def _apply_reputation(self, participants_json: str, compliant: bool, responsible: str) -> None:
        if compliant:
            for display in _participant_names(participants_json):
                name = _norm_name(display)
                if name and name != "none":
                    self.reputation[name] = self.reputation.get(name, 100) + 2
        else:
            key = _norm_name(responsible)
            if key and key != "none" and key != "unknown":
                self.reputation[key] = self.reputation.get(key, 100) - 10

    def _reverse_reputation(self, wid: str) -> None:
        # Undo the reputation effect of the stored verdict so a dispute
        # re-adjudication starts from a clean slate. Exact inverse of apply.
        if wid not in self.verdicts:
            return
        v = self.verdicts[wid]
        wf = self.workflows[wid]
        if v.compliant:
            for display in _participant_names(wf.participants_json):
                name = _norm_name(display)
                if name and name != "none":
                    self.reputation[name] = self.reputation.get(name, 100) - 2
        else:
            key = _norm_name(v.responsible_party)
            if key and key != "none" and key != "unknown":
                self.reputation[key] = self.reputation.get(key, 100) + 10

    def _store_verdict(
        self,
        wid: str,
        compliant: bool,
        responsible: str,
        score: int,
        reason: str,
    ) -> dict:
        wf = self.workflows[wid]
        escrowed = int(wf.escrowed)
        penalty = 0
        if not compliant:
            penalty = min(int(wf.penalty_atto), escrowed) if escrowed > 0 else int(wf.penalty_atto)

        self.verdicts[wid] = Verdict(
            compliant=compliant,
            responsible_party=responsible,
            score=score,
            penalty_applied_atto=penalty,
            reason=reason,
        )
        now = _now()
        wf.status = "compliant" if compliant else "breached"
        wf.verdict_time = u256(now)
        wf.settle_after = u256(now) + wf.dispute_window_sec
        self.workflows[wid] = wf
        self._apply_reputation(wf.participants_json, compliant, responsible)
        return {
            "workflow_id": wid,
            "compliant": compliant,
            "responsible_party": responsible,
            "score": score,
            "penalty_applied_atto": str(penalty),
            "settle_after": now + int(wf.dispute_window_sec),
            "reason": reason,
        }

    @gl.public.write
    def adjudicate_workflow(self, workflow_id: str) -> dict:
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        if wf.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Workflow already adjudicated")
        if wf.owner != gl.message.sender_address:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only workflow owner can adjudicate")
        if wid not in self.evidence:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No evidence submitted yet")

        result = self._adjudicate(wid)
        return self._store_verdict(
            wid,
            bool(result["compliant"]),
            str(result["responsible_party"]),
            int(result["score"]),
            str(result["reason"])[:MAX_REASON_LEN],
        )

    @gl.public.write
    def open_dispute(self, workflow_id: str, note: str) -> dict:
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        sender = gl.message.sender_address
        if wf.owner != sender and wf.beneficiary != sender:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner or beneficiary can dispute")
        if wf.status not in ("compliant", "breached"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No verdict to dispute yet")
        if bool(wf.settled):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Workflow already settled")
        if u256(_now()) >= wf.settle_after:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Dispute window closed, use settle_workflow")
        if int(wf.appeal_count) >= 1:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only one dispute round allowed")
        if len(note) > MAX_NOTE_LEN:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Dispute note too long")

        self._reverse_reputation(wid)
        wf.status = "disputed"
        wf.dispute_note = note
        wf.appeal_count = wf.appeal_count + 1
        self.workflows[wid] = wf
        return {"workflow_id": wid, "status": "disputed"}

    @gl.public.write
    def resolve_dispute(self, workflow_id: str) -> dict:
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        sender = gl.message.sender_address
        if wf.owner != sender and wf.beneficiary != sender:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only owner or beneficiary can resolve")
        if wf.status != "disputed":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No open dispute")
        note = str(wf.dispute_note)

        result = self._adjudicate(wid, note)
        return self._store_verdict(
            wid,
            bool(result["compliant"]),
            str(result["responsible_party"]),
            int(result["score"]),
            str(result["reason"])[:MAX_REASON_LEN],
        )

    @gl.public.write
    def settle_workflow(self, workflow_id: str) -> dict:
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        if wf.status not in ("compliant", "breached"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No final verdict to settle")
        if bool(wf.settled):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Already settled")
        if u256(_now()) < wf.settle_after:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Dispute window still open")
        amount = int(wf.escrowed)
        if amount <= 0:
            wf.settled = True
            self.workflows[wid] = wf
            return {"workflow_id": wid, "settled_amount_atto": "0", "recipient": "none"}

        verdict = self.verdicts[wid]
        recipient = wf.beneficiary if bool(verdict.compliant) else wf.owner
        _EoaPayout(recipient).emit_transfer(value=u256(amount))
        wf.escrowed = u256(0)
        wf.settled = True
        self.workflows[wid] = wf
        return {
            "workflow_id": wid,
            "settled_amount_atto": str(amount),
            "recipient": recipient.as_hex,
        }

    @gl.public.write
    def recover_escrow(self, workflow_id: str) -> dict:
        # Escape hatch so funds are never locked indefinitely: if the
        # workflow never reached a verdict (abandoned or adjudication
        # inconclusive), the owner can reclaim the escrow after the deadline
        # plus one dispute window. Once ANY verdict exists (including a
        # disputed one), funds follow the verdict path only — recovery is
        # unavailable so a verdict can never be bypassed.
        wid = workflow_id.strip()
        if wid not in self.workflows:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unknown workflow")
        wf = self.workflows[wid]
        if wf.owner != gl.message.sender_address:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only workflow owner can recover")
        if bool(wf.settled):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Already settled")
        if wf.status != "open":
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Verdict path active, use dispute/settle flow")
        if u256(_now()) <= wf.deadline_unix + wf.dispute_window_sec:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Recovery not yet available")
        amount = int(wf.escrowed)
        if amount <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No escrow to recover")
        _EoaPayout(wf.owner).emit_transfer(value=u256(amount))
        wf.escrowed = u256(0)
        wf.settled = True
        self.workflows[wid] = wf
        return {"workflow_id": wid, "recovered_atto": str(amount)}

    @gl.public.view
    def get_workflow(self, workflow_id: str) -> dict:
        wid = workflow_id.strip()
        if wid not in self.workflows:
            return {}
        wf = self.workflows[wid]
        return {
            "workflow_id": wf.workflow_id,
            "owner": wf.owner.as_hex,
            "description": wf.description,
            "sla_criteria": wf.sla_criteria,
            "deadline_unix": int(wf.deadline_unix),
            "participants_json": wf.participants_json,
            "penalty_atto": str(wf.penalty_atto),
            "status": wf.status,
            "evidence_count": int(wf.evidence_count),
            "beneficiary": wf.beneficiary.as_hex,
            "escrowed_atto": str(wf.escrowed),
            "dispute_window_sec": int(wf.dispute_window_sec),
            "verdict_time": int(wf.verdict_time),
            "settle_after": int(wf.settle_after),
            "appeal_count": int(wf.appeal_count),
            "settled": bool(wf.settled),
            "contract_balance_atto": str(self.balance),
        }

    @gl.public.view
    def list_workflows(self) -> list:
        return [wid for wid in self.workflow_ids]

    @gl.public.view
    def get_evidence(self, workflow_id: str) -> str:
        return self.evidence.get(workflow_id.strip(), "[]")

    @gl.public.view
    def get_evidence_page(self, workflow_id: str, offset: u256, limit: u256) -> dict:
        wid = workflow_id.strip()
        try:
            items = json.loads(self.evidence.get(wid, "[]"))
        except Exception:
            items = []
        if not isinstance(items, list):
            items = []
        total = len(items)
        off = int(offset)
        lim = int(limit)
        if off < 0:
            off = 0
        if lim <= 0 or lim > EVIDENCE_PAGE_LIMIT:
            lim = EVIDENCE_PAGE_LIMIT
        page = items[off : off + lim]
        return {
            "workflow_id": wid,
            "total": total,
            "offset": off,
            "limit": lim,
            "items_json": json.dumps(page),
        }

    @gl.public.view
    def get_verdict(self, workflow_id: str) -> dict:
        wid = workflow_id.strip()
        if wid not in self.verdicts:
            return {}
        v = self.verdicts[wid]
        return {
            "compliant": v.compliant,
            "responsible_party": v.responsible_party,
            "score": int(v.score),
            "penalty_applied_atto": str(v.penalty_applied_atto),
            "reason": v.reason,
        }

    @gl.public.view
    def get_reputation(self, agent_name: str) -> int:
        return int(self.reputation.get(_norm_name(agent_name), 100))

    @gl.public.view
    def get_equivalence_info(self) -> dict:
        # Static transparency record so the frontend can show exactly
        # which consensus rule produced every verdict. Values mirror the
        # validator logic in _adjudicate; update both together.
        return {
            "method": "custom run_nondet_unsafe validator with independent rerun",
            "decision_fields": ["compliant", "responsible_party", "score"],
            "compliant_rule": "exact match between leader and validator",
            "responsible_rule": "exact match after lowercase normalization",
            "score_tolerance": 15,
            "score_range": "0-100",
            "rejection_gate": "score 0 (reject) must be unanimous",
            "reason_compared": False,
            "evidence_source": "on-chain evidence plus contract-fetched URL content, same acquisition on leader and validators",
            "timestamps": "deterministic tx time; evidence carries recorded submitted_at",
            "settlement": "escrow released via finalized EOA transfer after dispute window",
            "dispute": "one owner-or-beneficiary dispute round with re-adjudication",
        }

    @gl.public.view
    def get_verdict_card(self, workflow_id: str) -> dict:
        # One-call bundle for the frontend: workflow + verdict +
        # participant reputations + the equivalence rule behind it.
        wid = workflow_id.strip()
        if wid not in self.workflows:
            return {}
        wf = self.workflows[wid]
        participants = _participant_names(wf.participants_json)
        reputations = {}
        for display in participants:
            key = _norm_name(display)
            if key:
                reputations[display] = int(self.reputation.get(key, 100))
        verdict = {}
        if wid in self.verdicts:
            v = self.verdicts[wid]
            verdict = {
                "compliant": v.compliant,
                "responsible_party": v.responsible_party,
                "score": int(v.score),
                "penalty_applied_atto": str(v.penalty_applied_atto),
                "reason": v.reason,
            }
        return {
            "workflow_id": wf.workflow_id,
            "owner": wf.owner.as_hex,
            "description": wf.description,
            "sla_criteria": wf.sla_criteria,
            "deadline_unix": int(wf.deadline_unix),
            "participants": participants,
            "penalty_atto": str(wf.penalty_atto),
            "status": wf.status,
            "evidence_count": int(wf.evidence_count),
            "beneficiary": wf.beneficiary.as_hex,
            "escrowed_atto": str(wf.escrowed),
            "dispute_window_sec": int(wf.dispute_window_sec),
            "verdict_time": int(wf.verdict_time),
            "settle_after": int(wf.settle_after),
            "appeal_count": int(wf.appeal_count),
            "settled": bool(wf.settled),
            "dispute_note": wf.dispute_note,
            "verdict": verdict,
            "reputations": reputations,
            "equivalence": {
                "method": "custom run_nondet_unsafe validator with independent rerun",
                "score_tolerance": 15,
                "rejection_gate": "score 0 (reject) must be unanimous",
            },
        }
