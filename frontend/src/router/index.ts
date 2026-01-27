import { createRouter, createWebHistory } from "vue-router"

const routes = [
  {
    path: "/login",
    component: () => import("@/views/LoginView.vue"),
  },
  {
    path: "/signup",
    component: () => import("@/views/SignupView.vue"),
  },
  {
    path: "/",
    component: () => import("@/views/DashboardView.vue"),
  },
  {
    path: "/arrangements/:id",
    component: () => import("@/views/ArrangementView.vue"),
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
