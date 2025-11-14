import { createContext, useContext } from 'react';

const ThemeOverrideContext = createContext(null);

export function ThemeOverrideProvider({ value, children }) {
  return (
    <ThemeOverrideContext.Provider value={value ?? null}>
      {children}
    </ThemeOverrideContext.Provider>
  );
}

export function useThemeOverride() {
  return useContext(ThemeOverrideContext);
}
