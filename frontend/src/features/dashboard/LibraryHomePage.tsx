import { useOutletContext } from 'react-router-dom'
import { Box, Grid, Paper, Skeleton, Stack, Typography, useTheme } from '@mui/material'
import { ResponsiveBar } from '@nivo/bar'
import PeopleAltIcon from '@mui/icons-material/PeopleAltOutlined'
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUpOutlined'
import { motion } from 'framer-motion'
import { useGetDashboardSummaryQuery } from './dashboardSummaryApi'
import type { Library } from '@/features/libraries/librariesApi'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}

function formatMonth(monthStr: string) {
  return new Date(monthStr).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string
  color: 'primary' | 'secondary' | 'success' | 'warning'
  delay: number
}

function StatCard({ icon: Icon, label, value, color, delay }: StatCardProps) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay }}
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 3, height: '100%' }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${color}.main`,
              color: `${color}.contrastText`,
            }}
          >
            <Icon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={700} noWrap>
              {value}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Grid>
  )
}

export function LibraryHomePage() {
  const { library } = useOutletContext<{ library: Library }>()
  const { data, isLoading } = useGetDashboardSummaryQuery(library.id)
  const theme = useTheme()

  const chartData =
    data?.monthly_series.map((m) => ({
      month: formatMonth(m.month),
      Revenue: Number(m.revenue),
      Expenses: Number(m.expenses),
    })) ?? []

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Welcome back
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {library.city ?? 'No city set'} · slug: {library.slug}
      </Typography>

      {isLoading || !data ? (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[0, 1, 2, 3].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rounded" height={92} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <StatCard icon={PeopleAltIcon} label="New students this month" value={String(data.new_students_this_month)} color="primary" delay={0} />
          <StatCard
            icon={PaymentsIcon}
            label="Amount collected this month"
            value={formatCurrency(Number(data.amount_collected_this_month))}
            color="success"
            delay={0.05}
          />
          <StatCard
            icon={ReceiptLongIcon}
            label="Expenses this month"
            value={formatCurrency(Number(data.expenses_this_month))}
            color="warning"
            delay={0.1}
          />
          <StatCard
            icon={TrendingUpIcon}
            label="Net this month"
            value={formatCurrency(Number(data.amount_collected_this_month) - Number(data.expenses_this_month))}
            color="secondary"
            delay={0.15}
          />
        </Grid>
      )}

      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 3, height: 380 }}
      >
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Revenue vs Expenses — last 4 months
        </Typography>
        {isLoading || !data ? (
          <Skeleton variant="rounded" height={300} />
        ) : chartData.length === 0 ? (
          <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary">No data yet</Typography>
          </Box>
        ) : (
          <Box sx={{ height: 300 }}>
            <ResponsiveBar
              data={chartData}
              keys={['Revenue', 'Expenses']}
              indexBy="month"
              groupMode="grouped"
              margin={{ top: 10, right: 20, bottom: 40, left: 60 }}
              padding={0.3}
              colors={[theme.palette.primary.main, theme.palette.warning.main]}
              borderRadius={4}
              axisBottom={{ tickSize: 0, tickPadding: 8 }}
              axisLeft={{ tickSize: 0, tickPadding: 8, format: (v) => `₹${Number(v) / 1000}k` }}
              enableLabel={false}
              theme={{
                text: { fill: theme.palette.text.secondary, fontSize: 12 },
                grid: { line: { stroke: theme.palette.divider } },
                axis: { ticks: { text: { fill: theme.palette.text.secondary } } },
              }}
              legends={[
                {
                  dataFrom: 'keys',
                  anchor: 'top-right',
                  direction: 'row',
                  translateY: -10,
                  itemWidth: 90,
                  itemHeight: 20,
                  symbolSize: 10,
                  symbolShape: 'circle',
                },
              ]}
              animate
            />
          </Box>
        )}
      </Paper>
    </Box>
  )
}
