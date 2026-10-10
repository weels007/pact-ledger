import { createApp, reactive } from "vue";
import router from "./router.js";
import App from "./App.vue";
import "./style.css";

// Tiny global store: wallet address + tx tracker handle.
export const store = reactive({
  address: "",
  tx: null,
});

const app = createApp(App);
app.use(router);
app.mount("#app");
