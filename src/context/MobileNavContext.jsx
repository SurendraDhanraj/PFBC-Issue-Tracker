import { createContext, useContext, useState } from 'react';

const MobileNavContext = createContext(null);

export function MobileNavProvider({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileNavContext.Provider value={{ open, setOpen }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}
