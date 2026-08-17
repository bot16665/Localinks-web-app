'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const supabase = createClient()

type Message = {
  id: string
  chat_id: string
  sender_id: string
  content: string
  sent_at: string
}

type Profile = {
  name: string
  profile_photo_url: string
}

type Chat = {
  id: string
  user_one_id: string
  user_two_id: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function ChatPage() {
  const router = useRouter()
  const params = useParams<{ chatId: string }>()
  const chatId = params.chatId

  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null)
  const [chat, setChat] = useState<Chat | null>(null)
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    if (!chatId) return

    const load = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      setCurrentUser(user)

      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single()

      if (chatError || !chatData) {
        setError('Chat not found')
        setLoading(false)
        return
      }

      if (chatData.user_one_id !== user.id && chatData.user_two_id !== user.id) {
        router.push('/')
        return
      }

      setChat(chatData)

      const otherUserId = chatData.user_one_id === user.id ? chatData.user_two_id : chatData.user_one_id

      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, profile_photo_url')
        .eq('id', otherUserId)
        .single()

      if (profileData) {
        setOtherUser(profileData as Profile)
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('sent_at', { ascending: true })

      if (messagesError) {
        setError('Failed to load messages')
      } else {
        setMessages(messagesData ?? [])
      }

      setLoading(false)
    }

    load()
  }, [chatId, router])

  useEffect(() => {
    if (!chatId) return

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser || !chatId || sending) return

    setSending(true)

    const { error: insertError } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      content: newMessage.trim(),
    })

    if (insertError) {
      setError('Failed to send message')
      setSending(false)
      return
    }

    setNewMessage('')
    setSending(false)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  const groupedMessages = messages.reduce<{ date: string; messages: Message[] }[]>((groups, msg) => {
    const dateKey = new Date(msg.sent_at).toLocaleDateString(undefined, {
      weekday: 'long', month: 'short', day: 'numeric'
    })
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
    const label = dateKey === today ? 'Today' : dateKey

    const existing = groups.find(g => g.date === label)
    if (existing) {
      existing.messages.push(msg)
    } else {
      groups.push({ date: label, messages: [msg] })
    }
    return groups
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !chat || !otherUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-on-surface-variant">{error || 'Chat not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-4 text-sm font-semibold text-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col antialiased">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-outline-variant/30">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 -ml-2 text-on-surface hover:bg-surface-container rounded-full transition-colors active:scale-95 flex items-center justify-center touch-target"
              aria-label="Back"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>

            <div className="relative">
              {otherUser.profile_photo_url ? (
                <img
                  src={otherUser.profile_photo_url}
                  alt={otherUser.name}
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-primary/40"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                  {getInitials(otherUser.name)}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background"></div>
            </div>

            <div className="flex flex-col">
              <h1 className="font-semibold text-sm sm:text-base leading-tight text-on-surface truncate">
                {otherUser.name}
              </h1>
              <span className="text-xs text-primary font-medium">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Feed */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-4 pb-28 flex flex-col gap-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center mb-3 border border-outline-variant/30">
              <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">waving_hand</span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant">Send a message to say hello!</p>
          </div>
        )}

        {groupedMessages.map(({ date, messages: dayMessages }) => (
          <div key={date} className="flex flex-col gap-3">
            <div className="flex justify-center my-1">
              <span className="bg-surface-container-low border border-outline-variant/30 text-on-surface-variant text-[11px] font-medium px-3 py-0.5 rounded-full">
                {date}
              </span>
            </div>

            {dayMessages.map((message) => {
              const isOwn = message.sender_id === currentUser?.id
              return (
                <div
                  key={message.id}
                  className={`flex gap-2 items-end ${isOwn ? 'max-w-[85%] sm:max-w-[75%] self-end justify-end' : 'max-w-[85%] sm:max-w-[75%]'}`}
                >
                  <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-2.5 shadow-sm text-sm sm:text-base leading-relaxed ${
                        isOwn
                          ? 'bg-primary text-on-primary rounded-2xl rounded-br-xs'
                          : 'bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-2xl rounded-bl-xs'
                      }`}
                    >
                      {message.content}
                    </div>

                    <span className={`text-[10px] text-on-surface-variant/60 flex items-center gap-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                      {formatTime(message.sent_at)}
                      {isOwn && (
                        <span className="material-symbols-outlined text-xs text-primary">
                          done_all
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Message Input Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-md border-t border-outline-variant/30 z-40 pb-safe">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-end gap-2.5">
          <div className="flex-1 bg-surface-container-low rounded-2xl border border-outline-variant/40 px-4 py-2 min-h-[44px] flex items-center focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
              placeholder="Type a message..."
              rows={1}
              className="w-full bg-transparent border-none p-0 focus:ring-0 resize-none text-sm sm:text-base text-on-surface placeholder:text-on-surface-variant/50 max-h-28 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="w-11 h-11 shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 touch-target"
            aria-label="Send message"
          >
            {sending ? (
              <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-xl icon-fill">send</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
