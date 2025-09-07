export default defineAppConfig({
  appMenu:{
    "admin-user":{
      id:"admin-user",
      name: 'admin-user-list',
      label: "adminMenu.User",
      icon: "dp-icon:user",
      hoverIcon: "dp-icon:user",
      component: "LazyCompanyUsers",
      feature: "CORE",
      props:{},
    },
  }
})