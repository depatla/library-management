import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Avatar, Box, Chip, CircularProgress, IconButton, Paper, Stack, TextField, Typography } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import SmartToyIcon from '@mui/icons-material/SmartToyOutlined'
import PersonIcon from '@mui/icons-material/PersonOutline'
import { motion, AnimatePresence } from 'framer-motion'
import { useAskAiMutation } from './aiAssistantApi'
import { extractErrorMessage } from '@/shared/crud/useCrudSnackbar'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  intent?: string
}

export function AiAssistantPage() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [askAi, { isLoading }] = useAskAiMutation()
  const [error, setError] = useState<string | null>(null)

  async function handleAsk() {
    const trimmed = question.trim()
    if (!trimmed || isLoading) return
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: trimmed }])
    setQuestion('')
    try {
      const res = await askAi({ libraryId: libraryId!, question: trimmed }).unwrap()
      setMessages((m) => [...m, { role: 'assistant', content: res.answer, intent: res.matched_intent }])
    } catch (err) {
      setError(extractErrorMessage(err))
    }
  }

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        height: { xs: 'calc(100dvh - 56px)', sm: 'calc(100dvh - 64px)' },
      }}
    >
      <Typography variant="h5" fontWeight={700} gutterBottom>
        AI Assistant
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Ask questions about occupancy, revenue, expenses, students, or upcoming expiries
      </Typography>

      <Paper variant="outlined" sx={{ flex: 1, borderRadius: 3, p: 2, mb: 2, overflowY: 'auto' }}>
        {messages.length === 0 ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">Ask something like "How many active students do we have?"</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                  <Stack direction="row" spacing={1.5} justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}>
                    {msg.role === 'assistant' && (
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                        <SmartToyIcon fontSize="small" />
                      </Avatar>
                    )}
                    <Box sx={{ maxWidth: '75%' }}>
                      <Paper
                        variant={msg.role === 'user' ? 'elevation' : 'outlined'}
                        elevation={msg.role === 'user' ? 2 : 0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          bgcolor: msg.role === 'user' ? 'primary.main' : 'background.default',
                          color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                        }}
                      >
                        <Typography variant="body2">{msg.content}</Typography>
                      </Paper>
                      {msg.intent && (
                        <Chip size="small" label={msg.intent} sx={{ mt: 0.5 }} variant="outlined" />
                      )}
                    </Box>
                    {msg.role === 'user' && (
                      <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                    )}
                  </Stack>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                  <SmartToyIcon fontSize="small" />
                </Avatar>
                <CircularProgress size={18} />
              </Stack>
            )}
          </Stack>
        )}
      </Paper>

      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          size="small"
          placeholder="Ask a question…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAsk()
          }}
        />
        <IconButton color="primary" onClick={handleAsk} disabled={isLoading || !question.trim()}>
          <SendIcon />
        </IconButton>
      </Stack>
    </Box>
  )
}
