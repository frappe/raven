# Copyright (c) 2026, Frappe Technologies Pvt. Ltd. and contributors
# License: MIT. See LICENSE

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
	from frappe.realtime import Socket

from frappe.realtime import get_user_room, realtime


@realtime.on("fire", allow_guest=True)
def fire(socket: Socket) -> None:
	socket.emit("ice")


@realtime.on("raven_channel_get_typers")
def raven_channel_get_typers(socket: Socket, channel: str) -> None:
	# Sent when a user opens a channel: reply to that user only with who is typing.
	if socket.has_permission("Raven Channel", channel):
		notify_typing(socket, channel, to_user=True)


@realtime.on("raven_channel_typing")
def raven_channel_typing(socket: Socket, channel: str) -> None:
	# Join the typing room and tell the channel this user is typing.
	socket.join(get_channel_typing_room(channel))
	notify_typing(socket, channel, to_user=False)


@realtime.on("raven_channel_typing_stopped")
def raven_channel_typing_stopped(socket: Socket, channel: str) -> None:
	# Leave the typing room and tell the channel this user stopped.
	socket.leave(get_channel_typing_room(channel))
	notify_typing(socket, channel, to_user=False)


def current_typers(socket: Socket, channel: str) -> list[str]:
	"""Distinct users currently in the channel's typing room."""
	sids = socket.participants(get_channel_typing_room(channel))
	users = [socket.user_of(sid) for sid in sids]
	return list(dict.fromkeys(u for u in users if u))


def notify_typing(socket: Socket, channel: str, to_user: bool) -> None:
	"""Emit the current typers for a channel.

	to_user=True  -> reply only to the requesting user (their user room).
	to_user=False -> broadcast to everyone viewing the channel (open-doc room).
	"""
	if not channel:
		return

	if to_user:
		room = get_user_room(socket.user)
	else:
		room = get_open_doc_room("Raven Channel", channel)

	users = current_typers(socket, channel)
	socket.emit("raven_channel_typers", {"channel": channel, "users": users}, room=room)


def get_channel_typing_room(channel: str) -> str:
	return f"raven_channel_typing:{channel}"


def get_open_doc_room(doctype: str, docname: str) -> str:
	return f"open_doc:{doctype}/{docname}"
