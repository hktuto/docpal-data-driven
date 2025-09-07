export default defineAppConfig({
  appMenu: {
    "admin-role": {
      id: "admin-role",
      name: 'admin-role',
      label: "ROLE-Page",
      icon: "lucide:file-cog",
      hoverIcon: "lucide:file-cog",
      component: "LazyCompanyRole",
      feature: "CORE",
      props: {},
    },
  }
})
