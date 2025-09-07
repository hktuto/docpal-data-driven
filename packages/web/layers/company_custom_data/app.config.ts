export default defineAppConfig({
  appMenu:{
    "custom_data":{
      id:"custom_data",
      name: 'custom_data',
      label: "Custom Data",
      icon: "dp-icon:user",
      hoverIcon: "dp-icon:user",
      component: "LazyCustomData",
      feature: "CORE",
      props:{},
    },
  }
})