'use client';

import { createTheme, useMediaQuery } from '@mui/material';
import { useMemo } from 'react';

const useLocalTheme = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
        },
      }),
    [prefersDarkMode],
  );

  return theme;
};


export default useLocalTheme;