"use client"

import { RiLogoutBoxRLine } from "@remixicon/react"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu"

import { authClient } from "@/lib/auth/auth-client"

type AccountMenuProps = { email: string; imageUrl?: string | null; name: string }

function AccountMenu({ email, imageUrl, name }: AccountMenuProps) {
  const router = useRouter()
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()

  async function signOut() {
    await authClient.signOut()
    router.replace("/")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Open account menu" className="rounded-full p-0" size="icon" variant="ghost">
          <Avatar size="sm"><AvatarImage alt="" src={imageUrl ?? undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel><p className="truncate font-medium text-foreground">{name}</p><p className="truncate font-normal text-muted-foreground">{email}</p></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}><RiLogoutBoxRLine />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { AccountMenu }
