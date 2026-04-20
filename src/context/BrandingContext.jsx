import { createContext, useContext } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const BrandingContext = createContext({
  appName: 'Point Fortin',
  tagline: 'Public Health Administration System',
  faviconUrl: null,
  splashUrl: null,
  logoIcon: '🏥',
});

export function BrandingProvider({ children }) {
  const settings = useQuery(api.settings.getAppSettings);
  const faviconUrl = useQuery(
    api.settings.getSettingsFileUrl,
    settings?.faviconStorageId ? { storageId: settings.faviconStorageId } : 'skip'
  );
  const splashUrl = useQuery(
    api.settings.getSettingsFileUrl,
    settings?.splashStorageId ? { storageId: settings.splashStorageId } : 'skip'
  );

  const value = {
    appName:    settings?.appName  || 'Point Fortin',
    tagline:    settings?.tagline  || 'Public Health Administration System',
    faviconUrl: faviconUrl  || null,
    splashUrl:  splashUrl   || null,
    // logoIcon is only used when no image is uploaded
    logoIcon:   '🏥',
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
