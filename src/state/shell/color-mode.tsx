import React from 'react'

import * as persisted from '#/state/persisted'

type StateContext = {
  colorMode: persisted.Schema['colorMode']
  themeColor: persisted.Schema['themeColor']
  darkTheme: persisted.Schema['darkTheme']
}
type SetContext = {
  setColorMode: (v: persisted.Schema['colorMode']) => void
  setThemeColor: (v: persisted.Schema['themeColor']) => void
  setDarkTheme: (v: persisted.Schema['darkTheme']) => void
}

const stateContext = React.createContext<StateContext>({
  colorMode: 'system',
  themeColor: 'blue',
  darkTheme: 'dark',
})
const setContext = React.createContext<SetContext>({} as SetContext)

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [colorMode, setColorMode] = React.useState(persisted.get('colorMode'))
  const [themeColor, setThemeColor] = React.useState(
    persisted.get('themeColor'),
  )
  const [darkTheme, setDarkTheme] = React.useState(persisted.get('darkTheme'))

  const stateContextValue = React.useMemo(
    () => ({
      colorMode,
      themeColor,
      darkTheme,
    }),
    [colorMode, themeColor, darkTheme],
  )

  const setContextValue = React.useMemo(
    () => ({
      setColorMode: (_colorMode: persisted.Schema['colorMode']) => {
        setColorMode(_colorMode)
        persisted.write('colorMode', _colorMode)
      },
      setThemeColor: (_themeColor: persisted.Schema['themeColor']) => {
        setThemeColor(_themeColor)
        persisted.write('themeColor', _themeColor)
      },
      setDarkTheme: (_darkTheme: persisted.Schema['darkTheme']) => {
        setDarkTheme(_darkTheme)
        persisted.write('darkTheme', _darkTheme)
      },
    }),
    [],
  )

  React.useEffect(() => {
    const unsubDarkTheme = persisted.onUpdate('darkTheme', nextDarkTheme => {
      setDarkTheme(nextDarkTheme)
    })
    const unsubColorMode = persisted.onUpdate('colorMode', nextColorMode => {
      setColorMode(nextColorMode)
    })

    const unsubThemeColor = persisted.onUpdate('themeColor', nextThemeColor => {
      setThemeColor(nextThemeColor)
    })

    return () => {
      unsubDarkTheme()
      unsubColorMode()
      unsubThemeColor()
    }
  }, [])

  return (
    <stateContext.Provider value={stateContextValue}>
      <setContext.Provider value={setContextValue}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useThemePrefs() {
  return React.useContext(stateContext)
}

export function useSetThemePrefs() {
  return React.useContext(setContext)
}
