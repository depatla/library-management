import { useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  CssBaseline,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  type Theme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/DashboardOutlined'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoomOutlined'
import LockIcon from '@mui/icons-material/LockOutlined'
import PeopleIcon from '@mui/icons-material/PeopleOutlined'
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined'
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined'
import HandshakeIcon from '@mui/icons-material/HandshakeOutlined'
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined'
import QrCodeIcon from '@mui/icons-material/QrCode2Outlined'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import SmartToyIcon from '@mui/icons-material/SmartToyOutlined'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import LogoutIcon from '@mui/icons-material/LogoutOutlined'
import SwapHorizIcon from '@mui/icons-material/SwapHorizOutlined'
import { motion, AnimatePresence } from 'framer-motion'
import { buildTheme } from '@/shared/theme/theme'
import { useGetLibraryQuery } from '@/features/libraries/librariesApi'
import { useLogoutMutation } from '@/features/auth/authApi'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { sessionCleared } from '@/features/auth/authSlice'

const DRAWER_WIDTH = 260

const NAV_ITEMS = [
  { segment: '', label: 'Dashboard', icon: DashboardIcon, end: true },
  { segment: 'rooms-cabins', label: 'Rooms & Cabins', icon: MeetingRoomIcon },
  { segment: 'lockers', label: 'Lockers', icon: LockIcon },
  { segment: 'students', label: 'Students', icon: PeopleIcon },
  { segment: 'payments', label: 'Payments', icon: PaymentsIcon },
  { segment: 'expenses', label: 'Expenses', icon: ReceiptIcon },
  { segment: 'partners', label: 'Partners', icon: HandshakeIcon },
  { segment: 'reports', label: 'Reports', icon: AssessmentIcon },
  { segment: 'qr-codes', label: 'QR Codes', icon: QrCodeIcon },
  { segment: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon },
  { segment: 'ai-assistant', label: 'AI Assistant', icon: SmartToyIcon },
  { segment: 'settings', label: 'Settings', icon: SettingsIcon },
]

export function AppShell() {
  const { libraryId } = useParams<{ libraryId: string }>()
  const { data: library, isLoading } = useGetLibraryQuery(libraryId!)
  const [logout] = useLogoutMutation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAppSelector((s) => s.auth.user)
  const memberships = user?.memberships ?? []

  const isMobile = useMediaQuery((t: Theme) => t.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)

  const libraryTheme = useMemo(
    () => (library ? buildTheme(library.theme_mode, library.primary_color, library.secondary_color) : null),
    [library],
  )

  async function handleLogout() {
    setMenuAnchor(null)
    await logout().catch(() => null)
    dispatch(sessionCleared())
    navigate('/login', { replace: true })
  }

  if (isLoading || !library || !libraryTheme) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ gap: 1.5, px: 2.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontWeight: 700 }}>
          {library.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {library.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {library.city ?? library.slug}
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, py: 1, px: 1 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const to = `/libraries/${libraryId}${item.segment ? `/${item.segment}` : ''}`
          return (
            <ListItemButton
              key={item.segment}
              component={NavLink}
              to={to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                '&.active': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                  '&:hover': { bgcolor: 'primary.dark' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
            </ListItemButton>
          )
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Chip
          size="small"
          label={library.status}
          color={library.status === 'active' ? 'success' : 'default'}
          sx={{ width: '100%' }}
        />
      </Box>
    </Box>
  )

  return (
    <ThemeProvider theme={libraryTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <AppBar
          position="fixed"
          color="transparent"
          elevation={0}
          sx={{
            zIndex: (t) => t.zIndex.drawer + 1,
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { md: `${DRAWER_WIDTH}px` },
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
              {NAV_ITEMS.find((n) => `/libraries/${libraryId}${n.segment ? `/${n.segment}` : ''}` === location.pathname)?.label ??
                'Dashboard'}
            </Typography>
            {memberships.length > 1 && (
              <Tooltip title="Switch library">
                <IconButton size="small" onClick={() => navigate('/libraries')}>
                  <SwapHorizIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'secondary.main' }}>
                {(user?.full_name ?? '?').charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              <MenuItem disabled sx={{ opacity: '1 !important' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {user?.full_name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user?.email}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Sign out
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
          <Drawer
            variant={isMobile ? 'temporary' : 'permanent'}
            open={isMobile ? mobileOpen : true}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none', borderRight: isMobile ? 'none' : 1, borderColor: 'divider' },
            }}
          >
            {drawerContent}
          </Drawer>
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
            bgcolor: 'background.default',
            minHeight: '100vh',
          }}
        >
          <Toolbar />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <Outlet context={{ library }} />
            </motion.div>
          </AnimatePresence>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
