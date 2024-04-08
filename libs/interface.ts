export interface InfoGempa {
    id: string;
    lng: number;
    lat: number;
    mag: number;
    depth: string;
    place?: string;
    time?: string;
    message?: string;
    listKotaTerdampak?: KotaTerdampak[];
  }
  
  export interface KotaTerdampak {
    lng: number;
    lat: number;
    distance: number;
    name: string;
    hit: boolean;
    timeArrival?: Date;
  }