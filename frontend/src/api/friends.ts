import api from "./client"

const P = "/api/v1"

export type Friend = {
  id: string
  name: string
  email: string
}

export type FriendRequestItem = {
  id: string
  from: { id: string; name: string; email: string }
  createdAt: string
}

export function sendFriendRequest(email: string) {
  return api.post<{ message: string; to: Friend }>(`${P}/friends/request`, {
    email,
  })
}

export function listFriendRequests() {
  return api.get<{ requests: FriendRequestItem[] }>(`${P}/friends/requests`)
}

export function respondToFriendRequest(
  requestId: string,
  decision: "accept" | "reject"
) {
  return api.post<{ status: string; message: string }>(
    `${P}/friends/requests/${requestId}/respond`,
    { decision }
  )
}

export function listFriends() {
  return api.get<{ friends: Friend[] }>(`${P}/friends`)
}

export function removeFriend(userId: string) {
  return api.delete<{ message: string }>(`${P}/friends/${userId}`)
}
