'use client'

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export var STATUS_COLORS = {
  urgent:     { bg: '#FCEBEB', text: '#E24B4A', label: 'Urgentné' },
  high:       { bg: '#FAEEDA', text: '#C47F0A', label: 'Vysoká' },
  normal:     { bg: '#E1F5EE', text: '#1D9E75', label: 'Normálna' },
  low:        { bg: '#E6F1FB', text: '#378ADD', label: 'Nízka' },
  monitoring: { bg: '#F3F4F6', text: '#6B7280', label: 'Monitorovanie' },
  resolved:   { bg: '#F3F4F6', text: '#9CA3AF', label: 'Vyriešené' },
  done:       { bg: '#F3F4F6', text: '#9CA3AF', label: 'Hotové' },
  open:       { bg: '#FAEEDA', text: '#C47F0A', label: 'Otvorené' },
  active:     { bg: '#E1F5EE', text: '#1D9E75', label: 'Aktívna' },
  waiting:    { bg: '#FAEEDA', text: '#C47F0A', label: 'Čakáme' },
  appealed:   { bg: '#F3E8FF', text: '#7C3AED', label: 'Odvolanie' },
}

export function sc(s) { return STATUS_COLORS[s] || STATUS_COLORS.normal }

export function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
}

export function formatDateTime(d) {
  return d ? new Date(d).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

export function isOverdue(d) {
  return d && new Date(d) < new Date(new Date().toDateString())
}

export function isSoon(d) {
  if (!d) return false
  var diff = (new Date(d) - new Date(new Date().toDateString())) / 86400000
  return diff >= 0 && diff <= 7
}
