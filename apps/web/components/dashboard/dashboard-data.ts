import {
  RiDashboardLine,
  RiFlashlightLine,
  RiLayoutGridLine,
  RiPulseLine,
  RiSettings3Line,
  RiShieldUserLine,
} from "@remixicon/react"

const dashboardNavItems = [
  {
    href: "/dashboard",
    icon: RiDashboardLine,
    label: "Overview",
  },
  {
    href: "/components",
    icon: RiLayoutGridLine,
    label: "Components",
  },
  {
    href: "/settings",
    icon: RiSettings3Line,
    label: "Settings",
  },
]

const dashboardStats = [
  {
    icon: RiShieldUserLine,
    label: "Synced users",
    value: "1",
  },
  {
    icon: RiPulseLine,
    label: "Webhook state",
    value: "Live",
  },
  {
    icon: RiFlashlightLine,
    label: "API health",
    value: "Online",
  },
]

const dashboardActivity = [
  "User account created",
  "Current user profile synced",
  "Dashboard session initialized",
]

export { dashboardActivity, dashboardNavItems, dashboardStats }
