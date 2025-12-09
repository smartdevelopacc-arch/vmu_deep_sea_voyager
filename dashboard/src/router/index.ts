import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Players from '../views/Players.vue'
import Games from '../views/Games.vue'
import GameControl from '../views/GameControl.vue'
import CreateGame from '../views/CreateGame.vue'
import GameSettings from '../views/GameSettings.vue'
import Maps from '../views/Maps.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard
    },
    {
      path: '/players',
      name: 'players',
      component: Players
    },
    {
      path: '/games',
      name: 'games',
      component: Games
    },
    {
      path: '/games/create',
      name: 'create-game',
      component: CreateGame
    },
    {
      path: '/game/:id',
      name: 'game-control',
      component: GameControl
    },
    {
      path: '/games/:id/control',
      name: 'game-control-alt',
      component: GameControl
    },
    {
      path: '/game/:id/settings',
      name: 'game-settings',
      component: GameSettings
    },
    {
      path: '/maps',
      name: 'maps',
      component: Maps
    }
  ]
})

export default router
