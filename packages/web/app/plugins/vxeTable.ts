
import VxeUI from 'vxe-pc-ui';
import 'vxe-pc-ui/lib/style.css';
import VxeUITable from 'vxe-table';
import 'vxe-table/lib/style.css';
// import VxeUIPluginRenderElement from '@vxe-ui/plugin-render-element';
import '@vxe-ui/plugin-render-element/dist/style.css';


export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.use(VxeUI).use(VxeUITable);
  const i18n = nuxtApp.$i18n as any;
  // VxeUI.use(VxeUIPluginRenderElement);
  VxeUI.setConfig({
    // 对组件内置的提示语进行国际化翻译
    i18n: (key, args) => i18n.t(key, args),
    translate: (key, args) => i18n.t(key, args)
  });
});
