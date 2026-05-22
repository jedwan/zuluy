export interface AlternateName {
  name: string;
  lang: string;
  isPreferred: boolean;
}

export interface City {
  id: string;
  name: string;
  asciiName: string;
  country: string;
  countryName: string;
  lat: number;
  lng: number;
  hemisphere: 'north' | 'south';
  tz: string;
  utcOffsetMinutes: number;
  population: number;
  recognitionScore: number;
  alternateNames: AlternateName[];
}
