export default defineAppConfig({
  appMenu: {
    "admin-group": {
      id: "admin-group",
      name: 'admin-group',
      label: "admin-group-list",
      icon: "mingcute:group-line",
      hoverIcon: "mingcute:group-line",
      component: "LazyCompanyGroup",
      feature: "CORE",
      props: {},
    },
  }
})
