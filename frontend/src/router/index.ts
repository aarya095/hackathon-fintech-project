import { createRouter, createWebHistory } from "vue-router"
import { useAuthStore } from "@/stores/auth"

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

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return "/login"
  }

  if (
    (to.path === "/login" || to.path === "/signup") &&
    auth.isAuthenticated
  ) {
    return "/dashboard"
  }
})