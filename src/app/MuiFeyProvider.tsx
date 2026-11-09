'use client'

// MUI is used for the multi-select on the ratios evolution page.
// This theme aligns it with the Fey token layer (dark surfaces, pill chips).
import type { ReactNode } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'

const feyTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#479ffa' },
    secondary: { main: '#4ebe96' },
    error: { main: '#e06c5a' },
    success: { main: '#4ebe96' },
    warning: { main: '#ffa16c' },
    background: { default: '#0b0b0b', paper: '#191919' },
    text: { primary: '#ffffff', secondary: '#868f97', disabled: '#525252' },
    divider: '#262626',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 13,
    body1: { fontSize: 13 },
    body2: { fontSize: 12 },
    caption: { fontSize: 11 },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#131313',
          borderRadius: 10,
          fontSize: 13,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#262626' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#525252' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#479ffa',
            borderWidth: 1,
          },
          '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(71, 159, 250, 0.18)' },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#868f97',
          fontSize: 12,
          '&.Mui-focused': { color: '#479ffa' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: '#868f97' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#191919',
          border: '1px solid #262626',
          borderRadius: 12,
          boxShadow: 'rgba(0, 0, 0, 0.8) 0 0 44px 0',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          margin: '2px 6px',
          borderRadius: 8,
          fontSize: 13,
          color: '#cccccc',
          '&:hover': { backgroundColor: '#1f1f1f' },
          '&.Mui-selected': { backgroundColor: '#1f1f1f', color: '#ffffff' },
          '&.Mui-selected:hover': { backgroundColor: '#262626' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: 24,
          borderRadius: 99,
          backgroundColor: '#1f1f1f',
          border: '1px solid #262626',
          color: '#cccccc',
          fontSize: 11,
        },
        deleteIcon: { color: '#868f97' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#191919',
          border: '1px solid #262626',
          color: '#ffffff',
          fontSize: 11,
        },
      },
    },
  },
})

export default function MuiFeyProvider({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={feyTheme}>{children}</ThemeProvider>
}
