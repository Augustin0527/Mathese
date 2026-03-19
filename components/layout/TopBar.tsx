'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin } from 'lucide-react';

export default function TopBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [lieu, setLieu] = useState<string | null>(null);
  const [lieuLoading, setLieuLoading] = useState(false);

  // Horloge en temps réel
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Géolocalisation + reverse geocoding (une seule fois)
  useEffect(() => {
    if (!navigator.geolocation) return;
    setLieuLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'fr' } }
          );
          const data = await res.json();
          const addr = data?.address;
          const ville =
            addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || '';
          const pays = addr?.country_code?.toUpperCase() ?? '';
          setLieu(ville ? `${ville}${pays ? ', ' + pays : ''}` : null);
        } catch {
          setLieu(null);
        } finally {
          setLieuLoading(false);
        }
      },
      () => setLieuLoading(false),
      { timeout: 8000 }
    );
  }, []);

  if (!now) return null;

  const date = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const heure = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex-shrink-0 flex items-center justify-end gap-4 px-5 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
      <span className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-gray-300" />
        <span className="capitalize">{date}</span>
        <span className="font-mono font-medium text-gray-700 tabular-nums">{heure}</span>
      </span>
      {(lieu || lieuLoading) && (
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-300" />
          {lieuLoading ? (
            <span className="text-gray-300">Localisation...</span>
          ) : (
            <span>{lieu}</span>
          )}
        </span>
      )}
    </div>
  );
}
