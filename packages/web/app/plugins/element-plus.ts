// @ts-ignore
import ElementPlus from 'element-plus'
export default defineNuxtPlugin(nuxtApp => {
    // Doing something with nuxtApp
    nuxtApp.vueApp.use(ElementPlus);
    const messages = ['success', 'warning', 'info', 'error'];
    const ElementUIMessage = nuxtApp.vueApp.config.globalProperties.$message as any
    messages.forEach(type => {
        ElementUIMessage[type] = (options: any) => {
            if (typeof options === 'string') {
                options = {
                    message: options
                };
                // 默认配置
            }
            if(!options.duration) options.duration = 6000;
            if(!options.showClose) options.showClose = true;
            options.type = type;
            return ElementUIMessage(options);
        }
    })
})