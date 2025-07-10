import React from 'react'
import { useTheme } from './ui/theme-provider'
import logoLight from '../assets/logo.png'
import logoDark from '../assets/logo_dark.png'

interface ThemeLogoProps {
  className?: string
  alt?: string
}

function ThemeLogo({
  className = 'h-10 w-auto',
  alt = 'Clean-Cut Logo'
}: ThemeLogoProps): React.JSX.Element {
  const { theme } = useTheme()

  // Determine which logo to show based on theme
  const getLogoSrc = () => {
    if (theme === 'dark') {
      return logoDark
    } else if (theme === 'light') {
      return logoLight
    } else {
      // System theme - check actual applied theme
      const isDark = document.documentElement.classList.contains('dark')
      return isDark ? logoDark : logoLight
    }
  }

  return <img src={getLogoSrc()} alt={alt} className={className} />
}

export default ThemeLogo
