import { createApp } from 'vue'
import App from './App.vue'
import { i18n, setLocale } from './i18n'
import { mountThirdwebConnectRoot } from './lib/thirdwebConnectBridge'
import './styles/global.css'

setLocale('en')
mountThirdwebConnectRoot()
createApp(App).use(i18n).mount('#app')
