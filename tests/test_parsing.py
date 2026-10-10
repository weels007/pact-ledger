"""Fast unit tests for PactLedger pure helpers.

Stubs the `genlayer` module so the contract file can be imported
without a GenVM runtime, then exercises the LLM-resilience parsers.
Run: python -m pytest tests/test_parsing.py -v
"""

import importlib.util
import sys
import types


def _install_genlayer_stub():
    if "genlayer" in sys.modules:
        return
    gl = types.ModuleType("genlayer")
    vm = types.SimpleNamespace()

    class UserError(Exception):
        def __init__(self, message=""):
            super().__init__(message)
            self.message = message

    vm.UserError = UserError
    vm.Result = object
    vm.Return = object
    gl.vm = vm

    def _passthrough(*a, **k):
        if len(a) == 1 and callable(a[0]) and not k:
            return a[0]
        if a and callable(a[0]):
            return a[0]
        def wrap(fn):
            return fn
        return wrap

    gl.allow_storage = _passthrough
    gl.Contract = object
    _write = _passthrough
    _write.payable = _passthrough
    gl.public = types.SimpleNamespace(
        view=_passthrough,
        write=_write,
    )
    gl.TreeMap = dict
    gl.DynArray = list
    gl.Address = str
    gl.u256 = int
    gl.i64 = int
    gl.message = types.SimpleNamespace(sender_address="0xtest")
    gl.gl = gl
    gl.__all__ = [
        "gl", "allow_storage", "TreeMap", "DynArray",
        "Address", "u256", "i64",
    ]
    gl.nondet = types.SimpleNamespace()
    gl.eq_principle = types.SimpleNamespace()
    gl.storage = types.SimpleNamespace(
        copy_to_memory=lambda x: x,
    )
    gl.evm = types.SimpleNamespace(
        contract_interface=_passthrough,
    )
    sys.modules["genlayer"] = gl


_install_genlayer_stub()

import pathlib

_contract_path = (
    pathlib.Path(__file__).resolve().parent.parent / "contracts" / "pact_ledger.py"
)
_spec = importlib.util.spec_from_file_location("pact_ledger", _contract_path)
assert _spec and _spec.loader
sla = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sla)


def test_clean_json_strips_markdown():
    raw = '```json\n{"compliant": true, "score": 90}\n```'
    assert sla._clean_json(raw) == {"compliant": True, "score": 90}


def test_parse_bool_variants():
    assert sla._parse_bool(True) is True
    assert sla._parse_bool("breached") is False
    assert sla._parse_bool("PASS") is True
    assert sla._parse_bool(0) is False


def test_parse_score_clamps():
    assert sla._parse_score("85") == 85
    assert sla._parse_score(120) == 100
    assert sla._parse_score(-5) == 0
    assert sla._parse_score("72.6") == 73


def test_norm_name():
    assert sla._norm_name(" Agent-Alpha ") == "agent-alpha"
    assert sla._norm_name(None) == "none"
