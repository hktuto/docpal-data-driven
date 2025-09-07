export default defineAppConfig({
  appMenu:{
    "client-work-panel":{
      id:"client-work-panel",
      name: 'adminMenu.workPanel',
      label: "adminMenu.workPanel",
      icon: "material-symbols:dashboard-customize-outline-rounded",
      hoverIcon: "material-symbols:dashboard-customize-outline-rounded",
      component: "LazyHome",
      feature: "CORE",
      props:{},
    },
  }
})