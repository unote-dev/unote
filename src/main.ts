import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './app.vue'
import IndexPage from './pages/index.vue'

import './assets/css/main.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: IndexPage },
  ],
})

const app = createApp(App)

app.use(router)
app.use(ui)

app.mount('#app')
