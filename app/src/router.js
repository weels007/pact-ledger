import { createRouter, createWebHistory } from "vue-router";
import Landing from "./views/Landing.vue";
import HowItWorks from "./views/HowItWorks.vue";
import Connect from "./views/Connect.vue";
import Dashboard from "./views/Dashboard.vue";
import NewPact from "./views/NewPact.vue";
import PactDetail from "./views/PactDetail.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Landing },
    { path: "/how-it-works", component: HowItWorks },
    { path: "/app", component: Dashboard },
    { path: "/app/connect", component: Connect },
    { path: "/app/new", component: NewPact },
    { path: "/app/pact/:id", component: PactDetail, props: true },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});
