'use client'
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from "mapbox-gl";
import './ui.css';
import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client'
import Worker from 'web-worker';
import TitikGempa from './components/mapbox_marker/titik_gempa';
import GempaBumiAlert from './components/GempaBumiAlert';
import * as turf from '@turf/turf'
import Card from './components/card/card';
import { createRoot } from 'react-dom/client';
import AnimatedPopup from 'mapbox-gl-animated-popup';
import ItemKotaTerdampak from './components/ItemKotaTerdampak';
import { KotaTerdampak, InfoGempa } from "../libs/interface";
import Jam from './components/Jam';
const { DateTime } = require("luxon");
import { IoLocationSharp } from "react-icons/io5";


mapboxgl.accessToken = 'pk.eyJ1IjoiYmFndXNpbmRyYXlhbmEiLCJhIjoiY2p0dHMxN2ZhMWV5bjRlbnNwdGY4MHFuNSJ9.0j5UAU7dprNjZrouWnoJyg';



let socket;
export default function Home() {
  const dangerSound = "/sounds/siren-alarm-96503.mp3"
  const smallEarthQuakeSound = "/sounds/wrong-answer-129254.mp3"
  const mapContainer = useRef<HTMLDivElement | null>(null); // Update the type of mapContainer ref
  const map = useRef<mapboxgl.Map | null>(null); // Update the type of the map ref
  const [lng, setLng] = useState(123.90146694265115);
  const [lat, setLat] = useState(-1.370489908625089);
  const [zoom, setZoom] = useState(5);

  const geoJsonData = useRef<any>(null);
  const geoJsonTitikGempa = useRef<any>(null);
  const worker = useRef<Worker | null>(null);


  const adaGempa = useRef<boolean>(false);
  // const [titikGempas, setTitikGempas] = useState<TitikGempa[]>([]);

  const tgs = useRef<TitikGempa[]>([]);
  const [alertGempaBumis, setAlertGempaBumis] = useState<InfoGempa[]>([]);
  const [infoGempas, setInfoGempas] = useState<InfoGempa[]>([]);
  const [stackAlert, setStackAlert] = useState<InfoGempa | null>(null);
  const [detailInfoGempa, setDetailInfoGempa] = useState<InfoGempa | null>(null);

  const kts = useRef<KotaTerdampak[]>([]);

  const igs = useRef<InfoGempa[]>([]);
  const markerDaerahs = useRef<any[]>([]);

  const lastGempaId = useRef<string>('');
  const lastGempaKecilId = useRef<string>('');

  const titikGempaKecil = useRef<TitikGempa | null>(null);
  const [infoGempaTerakhir, setInfoGempaTerakhir] = useState<InfoGempa | null>(null);
  const [infoGempaDirasakanTerakhir, setInfoGempaDirasakanTerakhir] = useState<InfoGempa | null>(null);

  const [loadingScreen, setLoadingScreen] = useState<boolean>(true);


  const warningHandler = async (data: any) => {
    const time = new Date().toLocaleTimeString();
    const id = data.id ?? `tg-${time}`;

   
    if (!map.current) return;
    map.current.flyTo({
      center: [data.lng, data.lat],
      zoom: 7,
      essential: true
    });

    

    const tg = new TitikGempa(id, {
      coordinates: [data.lng, data.lat],
      pWaveSpeed: 6000,
      sWaveSpeed: 3000,
      map: map.current!,
      description: data.message,
      mag: data.mag || 9.0,
      depth: data.depth || "10 Km",
      time: data.time || new Date().toLocaleString(),
      showPopUpInSecond: 6
    });

    

    tgs.current.push(tg);

    
    const nig: InfoGempa = {
      id: id,
      lng: parseFloat(data.lng),
      lat: parseFloat(data.lat),
      mag: data.mag || 9.0,
      depth: data.depth || "10 Km",
      message: data.message,
      place: data.place,
      time: data.time || new Date().toLocaleString()
    };

    igs.current.unshift(nig);
    const audioDangerElement = document.getElementById('danger');
    setTimeout(() => {
      
      if (audioDangerElement) {
        (audioDangerElement as HTMLAudioElement).play();
      }
    }, 2000);

    setAlertGempaBumis([...alertGempaBumis, nig]);
    //add data to first infoGempas
    setInfoGempas(igs.current);
    await new Promise(r => setTimeout(r, 6000));
    if (worker.current != null) {
      adaGempa.current = true;
      console.log("Send Wave");
      sendWave();
    }  
    if (audioDangerElement) {
      //set volume down
      (audioDangerElement as HTMLAudioElement).volume = 0.5;
    }

   

    // await new Promise(r => setTimeout(r, 4000));
    //setStackAlerts([...stackAlerts, data]);
  }

  const socketInitializer = () => {
    if (socket != null) return;
    fetch('/api/socket')
      .then(() => {

        console.log('Socket is initializing');

        socket = io();

        socket.on('connect', () => {
          console.log('connected');
        });
        socket.on('warning', (v: any) => {

          warningHandler(v);
        });
        socket.on('message', (v: any) => {

          console.log(v);
        });

      })
      .catch((error) => {
        console.error('Error initializing socket:', error);
      });
  };

  const initWorker = () => {
    worker.current = new Worker(
      new URL('./worker.mjs', import.meta.url),
      { type: 'module' }
    );

    worker.current.postMessage({ type: 'geoJsonData', data: geoJsonData.current });

    worker.current.addEventListener('message', (event: any) => {
      const data = event.data;
      // if (data.type == "checkMultiHighlightArea" && data.id == "s-wave") {
      //   recieveSWave(data);
      // }

      // if (data.type == "checkMultiHighlightArea" && data.id == "p-wave") {
      //   recievePWave(data);
      // }

      if (data.type == "checkMultiHighlightArea" && data.id == "wave") {
        recieveWave(data);
      }
    });
  }




  useEffect(() => {
    if (map.current) return () => { };
    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [lng, lat],
      zoom: zoom,
      maxZoom: 22,
    });

    map.current.on('load', () => {
      loadGeoJsonData();
    });

    
  });

  useEffect(() => {

    socketInitializer();

    if (socket) return () => {
      socket!.disconnect();
    };


  }, [alertGempaBumis, infoGempas, stackAlert]);



  const sendWave = () => {
    let t: any = [];
    for (let i = 0; i < tgs.current.length; i++) {
      const v = tgs.current[i];
      if (!v.finish) {
        t.push({
          id: v.id,
          center: v.center,
          mag: v.mag,
          depth: v.depth,
          pWaveRadius: v.pWaveRadius,
          sWaveRadius: v.sWaveRadius,
          areaTerdampak: [],
          message: v.description
        })
      }

    }
    if (t.length > 0) {
      worker.current!.postMessage({ type: 'checkMultiHighlightArea', titikGempa: t, id: "wave" });
    }
  }


  const isEqual = (a, b) => a.id === b.id && a.name === b.name;


  const recieveWave = async (data: any) => {
    let alerts: InfoGempa[] = [];
    for (let x = 0; x < data.titikGempa.length; x++) {
      const tg = data.titikGempa[x];

      const nig: InfoGempa = {
        id: tg.id,
        lng: parseFloat(tg.center[1]),
        lat: parseFloat(tg.center[0]),
        mag: tg.mag,
        depth: tg.depth,
        message: tg.message,
        place: tg.place,
        time: new Date().toLocaleString(),
        listKotaTerdampak: []
      };

      for (let il = 0; il < tg.areaTerdampak.length; il++) {
        const at = tg.areaTerdampak[il];
        const dist = turf.distance(turf.point([tg.center[0], tg.center[1]]), turf.point([at.center[0], at.center[1]])) - (tg.sWaveRadius / 1000);
        const time = Math.floor(dist / 3) * 1000;
        nig.listKotaTerdampak!.push({
          lng: at.center[1],
          lat: at.center[0],
          distance: dist,
          name: at.alt_name,
          hit: at.hit,
          timeArrival: new Date(new Date().getTime() + time)
        });

      }

      //sort nig.listKotaTerdampak by distance
      nig.listKotaTerdampak!.sort((a, b) => a.distance - b.distance);

      alerts.push(nig);
    }

    //get last alert
    if (alerts.length > 0) {
      setStackAlert(alerts.slice(-1).pop()!);
    } else {
      setStackAlert(null);
    }

    const areas = data.area;

    // Hapus data array objek yang sama
    // const uniqueData = areas.filter((obj, index, self) =>
    //   index === self.findIndex((t) => isEqual(t.properties.mhid, obj.properties.mhid))
    // );

    const uniqueData = areas;

    for (let x = 0; x < uniqueData.length; x++) {
      const element = uniqueData[x];
      const p: number[] = turf.centroid(element).geometry.coordinates;
      if (markerDaerahs.current.findIndex((el) => el[0] == p[0] && el[1] == p[1]) == -1) {
        markerDaerahs.current.push([p[0], p[1]]);
        const markerParent = document.createElement('div');
        const markerEl = document.createElement('div');
        markerEl.innerHTML = '<p class="uppercase">' + element.properties.alt_name + '</p>';
        markerEl.classList.add('marker-daerah');
        markerEl.classList.add('show-pop-up');
        markerParent.appendChild(markerEl);
        new mapboxgl.Marker(markerParent)
          .setLngLat([p[0], p[1]])
          .addTo(map.current!)

      } else {

        const index = kts.current.findIndex((el) => el.lng == p[0] && el.lat == p[1]);
        if (index != -1) {

          // kts.current[index].distance += 16;
          // kts.current[index].hit = element.properties.hit;
          // setKotaTerdampak([...kotaTerdampak, ...kts.current]);
          // countdownTime();
        }
      }


    }

    if (map.current!.getSource('hightlight-wave')) {
      (map.current!.getSource('hightlight-wave') as mapboxgl.GeoJSONSource).setData({ "type": "FeatureCollection", "features": uniqueData });
    } else {
      map.current!.addSource('hightlight-wave', {
        'type': 'geojson',
        'data': { "type": "FeatureCollection", "features": uniqueData }
      });
    }

    if (!map.current!.getLayer('hightlight-wave-layer')) {
      map.current!.addLayer({
        'id': 'hightlight-wave-layer',
        'type': 'fill',
        'source': 'hightlight-wave',
        'layout': {},
        'paint': {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.8
        }
      });

      map.current!.moveLayer('outline');
      for (let tg of tgs.current) {
        if (map.current!.getLayer(tg.id)) {
          map.current!.moveLayer(tg.id);
        }
      }
    }

    sendWave();
  }

  const hoverWilayah = useRef<any>(null);
  function loadGeoJsonData() {
    fetch('/geojson/all_kabkota_ind_reduce.geojson')
      .then(response => response.json())
      .then(data => {
        geoJsonData.current = data;
        if (!map.current!.getSource('wilayah')) {
          map.current!.addSource('wilayah', {
            type: 'geojson',
            generateId: true,
            data: data
          });
          map.current!.addLayer({
            'id': 'outline',
            'type': 'line',
            'source': 'wilayah',
            'layout': {},
            'paint': {
              'line-color': '#807a72',
              'line-width': 1,
              'line-opacity':0.7
            }
          });

          map.current!.addLayer({
            'id': 'wilayah-fill',
            'type': 'fill',
            'source': 'wilayah',
            'layout': {

            },
            'paint': {
              'fill-color': 'red',
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.1,
                0
              ],

            }
          });

          // map.current!.on('mousemove', 'wilayah-fill', (e: any) => {
          //   if (e.features.length > 0) {
          //     if (hoverWilayah.current !== null) {
          //       map.current!.setFeatureState(
          //         { source: 'wilayah', id: hoverWilayah.current },
          //         { hover: false }
          //       );
          //     }
          //     hoverWilayah.current = e.features[0].id;
          //     map.current!.setFeatureState(
          //       { source: 'wilayah', id: hoverWilayah.current },
          //       { hover: true }
          //     );
          //   }
          // });

          // map.current!.on('mouseleave', 'wilayah-fill', () => {
          //   if (hoverWilayah.current !== null) {
          //     map.current!.setFeatureState(
          //       { source: 'wilayah', id: hoverWilayah.current },
          //       { hover: false }
          //     );
          //   }
          //   hoverWilayah.current = null;
          // });
        }
        // getTitikStationJson();
        getTitikGempaJson();
        getTimezoneGeojson();
        getFaultLineGeojson();
        initWorker();
      }).catch((error) => {
        alert("Failed load geojson data : " + error);
        console.error('Error fetching data:', error);
      });
  };

  function getTitikStationJson() {
    const url = "https://bmkg-content-inatews.storage.googleapis.com/sensor_seismic.json";
    if (map.current) {
      map.current.loadImage(
        '/images/triangle-filled-svgrepo-com.png',
        (error, image: any) => {
          if (error) throw error;

          // Add the image to the map style.
          map.current!.addImage('station-icon', image);

          // Add a data source containing one point feature.
          map.current!.addSource('station', {
            'type': 'geojson',
            'data': url
          });

          // Add a layer to use the image to represent the data.
          map.current!.addLayer({
            'id': 'stations',
            'type': 'symbol',
            'source': 'station', // reference the data source
            'layout': {
              'icon-image': 'station-icon', // reference the image
              'icon-size': 0.05
            }
          });

          map.current!.on('click', 'stations', (e: any) => {
            // Copy coordinates array.
            const coordinates = e.features[0].geometry.coordinates.slice();
            const d = e.features[0].properties;
            const placeholder = document.createElement('div');
            const root = createRoot(placeholder)
            root.render(<Card title={
              <p className='font-bold text-glow-red text-sm text-center' style={{
                color: "red"
              }}>SENSOR SEISMIK</p>
            } className='min-h-48 min-w-48 whitespace-pre-wrap' >
              <div className='text-glow text-sm w-full ' style={{
                fontSize: "10px"
              }}><table className='w-full'>
                  <tbody>
                    <tr>
                      <td className='flex'>ID</td>
                      <td className='text-right break-words pl-2'>{d.id}</td>
                    </tr>
                    <tr>
                      <td className='flex'>Stakeholder</td>
                      <td className='text-right break-words pl-2'>{d.stakeholder}</td>
                    </tr>
                    <tr>
                      <td className='flex'>UPTBMKG</td>
                      <td className='text-right break-words pl-2'>{d.uptbmkg}</td>
                    </tr>
                    <tr>
                      <td className='flex'>Lokasi (Lat,Lng)</td>
                      <td className='text-right break-words pl-2'>{coordinates[0]} , {coordinates[1]}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>);

            new AnimatedPopup({
              openingAnimation: {
                duration: 100,
                easing: 'easeOutSine',
                transform: 'scale'
              },
              closingAnimation: {
                duration: 100,
                easing: 'easeInOutSine',
                transform: 'scale'
              }
            }).setDOMContent(placeholder).setLngLat(coordinates).addTo(map.current!);
          });

          map.current!.on('mouseenter', 'stations', () => {
            map.current!.getCanvas().style.cursor = 'pointer';
          });

          // Change it back to a pointer when it leaves.
          map.current!.on('mouseleave', 'stations', () => {
            map.current!.getCanvas().style.cursor = '';
          });
        }
      );

    }
  }

  function getTitikGempaJson() {
    const url = "https://bmkg-content-inatews.storage.googleapis.com/gempaQL.json?t=" + new Date().getTime();
    fetch(url)
      .then(response => response.json())
      .then((data) => {
        geoJsonTitikGempa.current = data;
        setTimeout(() => {
          document.getElementById("loading-screen")!.style.display = "none";
          setLoadingScreen(false);
        }, 1000);
        let ifg: InfoGempa[] = [];
        for (let index = 0; index < data.features.length; index++) {
          const feature = data.features[index];
          const dt = DateTime.fromSQL(feature.properties.time, { zone: 'UTC' }).setZone("Asia/Jakarta");
          const readAbleTime = dt.toISODate() + " " + dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS)
          ifg.push({
            id: feature.properties.id,
            lng: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1],
            mag: feature.properties.mag,
            depth: feature.properties.depth,
            place: feature.properties.place,
            time: readAbleTime
          });
        }
        igs.current = ifg;
        setInfoGempas(igs.current);
        console.log('load titik gempa 1');
        //check earthquakes layer
        if (map.current!.getLayer('earthquakes-layer')) {
          //update source
          (map.current!.getSource('earthquakes') as mapboxgl.GeoJSONSource).setData(data);
        } else {
          //add source
          map.current!.addSource('earthquakes', {
            type: 'geojson',
            data: data
          });

          map.current!.addLayer({
            'id': 'earthquakes-layer',
            'type': 'circle',
            'source': 'earthquakes',
            'paint': {
              'circle-radius': ["to-number", ['get', 'mag']],
              'circle-stroke-width': 2,

              'circle-color': [
                "case",
                //depth <= 50 red, depth <= 100 orange, depth <= 250 yellow, depth <= 600 green, depth > 600 blue
                ['<=', ["to-number", ['get', 'depth']], 50],
                "red",
                ['<=', ["to-number", ['get', 'depth']], 100],
                "orange",
                ['<=', ["to-number", ['get', 'depth']], 250],
                "yellow",
                ['<=', ["to-number", ['get', 'depth']], 600],
                "green",
                "blue",
              ],
              'circle-stroke-color': 'white'
            }
          });
        }

        map.current!.on('click', 'earthquakes-layer', (e: any) => {
          // Copy coordinates array.
          const coordinates = e.features[0].geometry.coordinates.slice();
          const d = e.features[0].properties;
          const placeholder = document.createElement('div');
          const root = createRoot(placeholder)
          root.render(<Card title={
            <div className='overflow-hidden'>
              <div className='strip-wrapper'><div className='strip-bar loop-strip-reverse anim-duration-20'></div><div className='strip-bar loop-strip-reverse anim-duration-20'></div></div>
              <div className='absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center'>
                <p className='p-1 bg-black font-bold text-xs text-glow'>GEMPA BUMI</p>
              </div>
            </div>
          } className='min-h-48 min-w-48 whitespace-pre-wrap' >
            <div className='text-glow text-sm w-full ' style={{
              fontSize: "10px"
            }}><table className='w-full'>
                <tbody>
                  <tr>
                    <td className='flex'>Magnitudo</td>
                    <td className='text-right break-words pl-2'>{d.mag}</td>
                  </tr>
                  <tr>
                    <td className='flex'>Kedalaman</td>
                    <td className='text-right break-words pl-2'>{d.depth}</td>
                  </tr>
                  <tr>
                    <td className='flex'>Waktu</td>
                    <td className='text-right break-words pl-2'>{new Date(d.time!).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className='flex'>Lokasi (Lat,Lng)</td>
                    <td className='text-right break-words pl-2'>{coordinates[0]} , {coordinates[1]}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>);

          new AnimatedPopup({
            openingAnimation: {
              duration: 100,
              easing: 'easeOutSine',
              transform: 'scale'
            },
            closingAnimation: {
              duration: 100,
              easing: 'easeInOutSine',
              transform: 'scale'
            }
          }).setDOMContent(placeholder).setLngLat(coordinates).addTo(map.current!);
        });

        map.current!.on('mouseenter', 'earthquakes-layer', () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to a pointer when it leaves.
        map.current!.on('mouseleave', 'earthquakes-layer', () => {
          map.current!.getCanvas().style.cursor = '';
        });

        console.log('load titik gempa 2');

        getGempa();
        getGempaKecil();

      })
      .catch((error) => {
        console.error('Error initializing socket:', error);
      });

  }

  const hoverTimezone = useRef<any>(null);
  function getTimezoneGeojson() {
    const url = "/geojson/timezones_wVVG8.geojson";
    map.current!.addSource('timezone', {
      'type': 'geojson',
      'generateId': true,
      'data': url
    });

    // Add a layer to use the image to represent the data.
    // map.current!.addLayer({
    //   'id': 'timezone-fill',
    //   'type': 'fill',
    //   'source': 'timezone', // reference the data source
    //   'layout': {

    //   },
    //   'paint': {
    //     // 'line-color': 'blue',
    //     // 'line-width': 1
    //     'fill-color': 'red',
    //     'fill-opacity': [
    //       'case',
    //       ['boolean', ['feature-state', 'hover'], false],
    //       0.1,
    //       0
    //     ],

    //   }
    // });

    map.current!.addLayer({
      'id': 'timezone-line',
      'type': 'line',
      'source': 'timezone', // reference the data source
      'layout': {

      },
      'paint': {
        'line-color': 'orange',
        'line-width': 1,
        'line-opacity': 0.5
      }
    });

    const markerParent1 = document.createElement('div');
    const gmt7Marker = createRoot(markerParent1)
    gmt7Marker.render(
      <div className='bordered p-1 text-time show-pop-up text-center'>
        <p className="uppercase text-xl" style={{
          lineHeight: "1rem"
        }}>
          <Jam timeZone="Asia/Jakarta" />
        </p>
        <p>WIB / GMT+7</p>
      </div>
    );

    new mapboxgl.Marker(markerParent1)
      .setLngLat([107.4999769225339, 3.4359354227361933])
      .addTo(map.current!);


    const markerParent2 = document.createElement('div');
    const gmt8Marker = createRoot(markerParent2)
    gmt8Marker.render(
      <div className='bordered p-1 text-time show-pop-up text-center'>
        <p className="uppercase text-xl" style={{
          lineHeight: "1rem"
        }}>
          <Jam timeZone="Asia/Makassar" />
        </p>
        <p>WITA / GMT+8</p>
      </div>
    );
    new mapboxgl.Marker(markerParent2)
      .setLngLat([119.1174733337183, 3.4359354227361933])
      .addTo(map.current!);

    const markerParent3 = document.createElement('div');
    const gmt9Marker = createRoot(markerParent3)
    gmt9Marker.render(
      <div className='bordered p-1 text-time show-pop-up text-center'>
        <p className="uppercase text-xl" style={{
          lineHeight: "1rem"
        }}>
          <Jam timeZone="Asia/Jayapura" />
        </p>
        <p className='text-xs'>WIT / GMT+9</p>
      </div>
    );
    new mapboxgl.Marker(markerParent3)
      .setLngLat([131.58387377752751, 3.4359354227361933])
      .addTo(map.current!)

    // map.current!.on('click', 'timezone-fill', (e: any) => {
    //   console.log(e);
    // });

    // map.current!.on('mousemove', 'timezone-fill', (e: any) => {
    //   if (e.features.length > 0) {
    //     if (hoverTimezone.current !== null) {
    //       map.current!.setFeatureState(
    //         { source: 'timezone', id: hoverTimezone.current },
    //         { hover: false }
    //       );
    //     }
    //     hoverTimezone.current = e.features[0].id;
    //     map.current!.setFeatureState(
    //       { source: 'timezone', id: hoverTimezone.current },
    //       { hover: true }
    //     );
    //   }
    // });

    // map.current!.on('mouseleave', 'timezone-fill', () => {
    //   if (hoverTimezone.current !== null) {
    //     map.current!.setFeatureState(
    //       { source: 'timezone', id: hoverTimezone.current },
    //       { hover: false }
    //     );
    //   }
    //   hoverTimezone.current = null;
    // });
  }

  function getFaultLineGeojson() {
    const url = "/geojson/indo_faults_lines.geojson";
    map.current!.addSource('indo_faults_lines', {
      'type': 'geojson',
      'generateId': true,
      'data': url
    });

    // Add a layer to use the image to represent the data.
    map.current!.addLayer({
      'id': 'indo_faults_line_layer',
      'type': 'line',
      'source': 'indo_faults_lines', // reference the data source
      'layout': {

      },
      'paint': {
        'line-color': 'red',
        'line-width': 1,
        'line-opacity': 0.5
        // 'fill-color': 'red',
        // 'fill-opacity': [
        //   'case',
        //   ['boolean', ['feature-state', 'hover'], false],
        //   0.1,
        //   0
        // ],

      }
    });


    
  }

  function getGempa() {
    if (lastGempaId.current) {
      return
    }
    console.log("getGempa");
    const url = "https://bmkg-content-inatews.storage.googleapis.com/datagempa.json?t=" + new Date().getTime();
    fetch(url)
      .then(response => response.json())
      .then((data) => {
        const coordinates = data.info.point.coordinates.split(",");
        lastGempaId.current = data.identifier;
        const sentTime = DateTime.fromISO(data.sent.replace("WIB", ""), { zone: "Asia/Jakarta" });
        const currentTime = DateTime.now().setZone("Asia/Jakarta");
        const readAbleTime = sentTime.toISODate() + " " + sentTime.toLocaleString(DateTime.TIME_24_WITH_SECONDS)

        const nig: InfoGempa = {
          id: data.identifier,
          lng: parseFloat(coordinates[0]),
          lat: parseFloat(coordinates[1]),
          mag: data.info.magnitude || 9.0,
          depth: data.info.depth || "10 Km",
          message: data.info.description,
          time: readAbleTime
        };

        const cek = igs.current.find((v) => v.id == data.identifier);
        if (!cek) {
          igs.current.push(nig);
          //sort by time
          igs.current.sort(function(a:any, b:any) {
            return new Date(b.time).getTime() - new Date(a.time).getTime();
            })
          geoJsonTitikGempa.current.features.push({
            "geometry": {
              "type": "Point",
              "coordinates": [
                nig.lng,
                nig.lat,
                1
              ]
            },
            "type": "Feature",
            "properties": {
              id: nig.id,
              depth: parseFloat(nig.depth.replaceAll(" Km","")).toFixed(2),
              mag: nig.mag,
              time: nig.time,
              place: nig.place,
            }
          });
          (map.current!.getSource('earthquakes') as mapboxgl.GeoJSONSource).setData(geoJsonTitikGempa.current);

          setInfoGempas(igs.current);
        }

        //if sent time is less than 5 minutes
        if ((currentTime.toMillis() - sentTime.toMillis()) < 600000) {

          warningHandler({
            id: data.identifier,
            lng: parseFloat(coordinates[0]),
            lat: parseFloat(coordinates[1]),
            mag: parseFloat(data.info.magnitude),
            depth: data.info.depth,
            message: data.info.description + "\n" + data.info.instruction,
            time: readAbleTime,
          });
          setTimeout(() => {
            setStackAlert(nig);
            setInfoGempaDirasakanTerakhir(nig);
          }, 6000);
        } else {
          setInfoGempaDirasakanTerakhir(nig);
        }

        // getGempaPeriodik();
      })
      .catch((error) => {
        console.error('Error initializing socket:', error);
      });


  }

  function getGempaKecil() {
    if (lastGempaKecilId.current) {
      return;
    }
    console.log("getGempaKecil");
    const url = "https://bmkg-content-inatews.storage.googleapis.com/lastQL.json?t=" + new Date().getTime();
    fetch(url)
      .then(response => response.json())
      .then((data) => {
        if (data.features.length > 0) {
          const feature = data.features[0];
          lastGempaKecilId.current = feature.properties.id;

          const sentTime = DateTime.fromSQL(feature.properties.time, { zone: 'UTC' });
          const currentTime = DateTime.now().setZone("UTC");

          const msg = `${feature.properties.place}
Magnitudo : ${feature.properties.mag}
Kedalaman : ${feature.properties.depth}
Lokasi (Lat,Lng) : 
${feature.geometry.coordinates[0]} , ${feature.geometry.coordinates[1]}`;

          const dt = DateTime.fromSQL(feature.properties.time, { zone: 'UTC' }).setZone("Asia/Jakarta");
          const readAbleTime = dt.toISODate() + " " + dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS)
          const nig: InfoGempa = {
            id: feature.properties.id,
            lng: parseFloat(feature.geometry.coordinates[0]),
            lat: parseFloat(feature.geometry.coordinates[1]),
            mag: parseFloat(parseFloat(feature.properties.mag).toFixed(1)) || 9.0,
            depth: feature.properties.depth || "10 Km",
            message: msg,
            place: feature.properties.place,
            time: readAbleTime
          };




          //if sent time is less than 10 minutes
          if ((currentTime.toMillis() - sentTime.toMillis()) < 600000) {

            if (map.current) {
              var notif = new Audio(smallEarthQuakeSound);
              notif.play();
              map.current!.flyTo({
                center: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
                zoom: 7,
                essential: true
              });

              const tg = new TitikGempa(feature.properties.id, {
                coordinates: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
                pWaveSpeed: 6000,
                sWaveSpeed: 3000,
                map: map.current!,
                description: msg,
                mag: parseFloat(feature.properties.mag) || 9.0,
                depth: feature.properties.depth || "10 Km",
                time:readAbleTime
              });



              if (titikGempaKecil.current) {
                titikGempaKecil.current.removeAllRender();
                titikGempaKecil.current.removeMarker();
                if (igs.current.length > 0) {
                  const ig = igs.current[0]
                  geoJsonTitikGempa.current.features.push({
                    "geometry": {
                      "type": "Point",
                      "coordinates": [
                        ig.lng,
                        ig.lat,
                        1
                      ]
                    },
                    "type": "Feature",
                    "properties": {
                      id: ig.id,
                      depth: ig.depth,
                      mag: ig.mag,
                      time: ig.time,
                      place: ig.place,
                    }
                  });
                  (map.current!.getSource('earthquakes') as mapboxgl.GeoJSONSource).setData(geoJsonTitikGempa.current);
                }

              }
              titikGempaKecil.current = tg;
            }

            setStackAlert(nig);

          } else {
            const cek = igs.current.find((v) => v.id == feature.properties.id);
            if (!cek) {
              igs.current.unshift(nig);
              geoJsonTitikGempa.current.features.push(feature);
              (map.current!.getSource('earthquakes') as mapboxgl.GeoJSONSource).setData(geoJsonTitikGempa.current);

              setInfoGempas(igs.current);
            }
          }

          setInfoGempaTerakhir(nig);


        }
        getGempaPeriodik();
      })
      .catch((error) => {
        console.error('Error initializing socket:', error);
      });
  }

  function getGempaPeriodik() {
    setInterval(() => {
      const url = "https://bmkg-content-inatews.storage.googleapis.com/datagempa.json?t=" + new Date().getTime()
      //await fetch
      fetch(url)
        .then(response => response.json())
        .then((data) => {
          if (lastGempaId.current != data.identifier) {
            lastGempaId.current = data.identifier;
            const coordinates = data.info.point.coordinates.split(",");
            const sentTime = DateTime.fromISO(data.sent.replace("WIB", ""), { zone: "Asia/Jakarta" });
            const readAbleTime = sentTime.toISODate() + " " + sentTime.toLocaleString(DateTime.TIME_24_WITH_SECONDS);

            warningHandler({
              id: data.identifier,
              lng: parseFloat(coordinates[0]),
              lat: parseFloat(coordinates[1]),
              mag: parseFloat(data.info.magnitude),
              depth: data.info.depth,
              message: data.info.description + "\n" + data.info.instruction,
              time:readAbleTime
            });
            // if (parseFloat(data.info.magnitude) > 5) {
            //   warningHandler({
            //     id: data.identifier,
            //     lng: parseFloat(coordinates[0]),
            //     lat: parseFloat(coordinates[1]),
            //     mag: parseFloat(data.info.magnitude),
            //     depth: data.info.depth,
            //     message: data.info.description + "\n" + data.info.instruction,
            //     time:readAbleTime
            //   });
            // } else {
            //   var notif = new Audio(smallEarthQuakeSound);
            //   notif.play();
            //   map.current!.flyTo({
            //     center: [parseFloat(coordinates[0]), parseFloat(coordinates[1])],
            //     zoom: 7,
            //     essential: true
            //   });

            //   const tg = new TitikGempa(data.identifier, {
            //     coordinates: [coordinates[0], coordinates[1]],
            //     pWaveSpeed: 6000,
            //     sWaveSpeed: 3000,
            //     map: map.current!,
            //     description: data.info.description + "\n" + data.info.instruction,
            //     mag: parseFloat(data.info.magnitude) || 9.0,
            //     depth: data.info.depth || "10 Km",
            //     time:readAbleTime
            //   });

            //   if (titikGempaKecil.current) {
            //     titikGempaKecil.current.removeAllRender();
            //   }
            //   titikGempaKecil.current = tg;

            // }
          }
        })
        .catch((error) => {
          console.error('Error initializing socket:', error);
        });
    }, 5000);

    setInterval(() => {
      const url = "https://bmkg-content-inatews.storage.googleapis.com/lastQL.json?t=" + new Date().getTime();
      fetch(url)
        .then(response => response.json())
        .then((data) => {
          const feature = data.features[0];
          const msg = `${feature.properties.place}
Magnitudo : ${feature.properties.mag}
Kedalaman : ${feature.properties.depth}
Lokasi (Lat,Lng) : 
${feature.geometry.coordinates[0]} , ${feature.geometry.coordinates[1]}`;

          const dt = DateTime.fromSQL(feature.properties.time, { zone: 'UTC' }).setZone("Asia/Jakarta");
          const readAbleTime = dt.toISODate() + " " + dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS)
          const nig: InfoGempa = {
            id: feature.properties.id,
            lng: parseFloat(feature.geometry.coordinates[1]),
            lat: parseFloat(feature.geometry.coordinates[0]),
            mag: parseFloat(feature.properties.mag) || 9.0,
            depth: feature.properties.depth || "10 Km",
            message: msg,
            place: feature.properties.place,
            time: readAbleTime
          };
          if (lastGempaKecilId.current != feature.properties.id) {
            lastGempaKecilId.current = feature.properties.id;
            var notif = new Audio(smallEarthQuakeSound);
            notif.play();
            if (!map.current) return;
            map.current.flyTo({
              center: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
              zoom: 7,
              essential: true
            });


            if (titikGempaKecil.current) {
              titikGempaKecil.current.removeAllRender();
              titikGempaKecil.current.removeMarker();
              if (igs.current.length > 0) {
                const ig = igs.current[0]
                geoJsonTitikGempa.current.features.push({
                  "geometry": {
                    "type": "Point",
                    "coordinates": [
                      ig.lng,
                      ig.lat,
                      1
                    ]
                  },
                  "type": "Feature",
                  "properties": {
                    id: ig.id,
                    depth: ig.depth,
                    mag: ig.mag,
                    time: ig.time,
                    place: ig.place,
                  }
                });
                (map.current!.getSource('earthquakes') as mapboxgl.GeoJSONSource).setData(geoJsonTitikGempa.current);
              }
            }

            igs.current.push(nig)
            igs.current.sort(function(a:any, b:any) {
              return new Date(b.time).getTime() - new Date(a.time).getTime();
              });
            setInfoGempas(igs.current);
            setStackAlert(nig);

            const tg = new TitikGempa(lastGempaKecilId.current, {
              coordinates: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
              pWaveSpeed: 6000,
              sWaveSpeed: 3000,
              map: map.current!,
              description: msg,
              mag: Number(feature.properties.mag) || 9.0,
              depth: feature.properties.depth || "10 Km",
              time:readAbleTime
            });

            titikGempaKecil.current = tg;
            setInfoGempaTerakhir(nig);
          }


        })
        .catch((error) => {
          console.error('Error initializing socket:', error);
        });
    }, 5000);
  }

  const selectedPopup = useRef<any>(null);

  function selectEvent(d: InfoGempa) {
    setDetailInfoGempa(d);
    if (selectedPopup.current) {
      selectedPopup.current.remove();
    }

    map.current!.flyTo({
      center: [d.lng, d.lat],
      zoom: 7,
      essential: true
    });
    const placeholder = document.createElement('div');
    const root = createRoot(placeholder)
    root.render(<Card title={
      <div className='overflow-hidden'>
        <div className='strip-wrapper'><div className='strip-bar loop-strip-reverse anim-duration-20'></div><div className='strip-bar loop-strip-reverse anim-duration-20'></div></div>
        <div className='absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center'>
          <p className='p-1 bg-black font-bold text-xs text-glow'>GEMPA BUMI</p>
        </div>
      </div>
    } className='min-h-48 min-w-48 whitespace-pre-wrap ' >
      <ul className='text-glow'>
        <li>
          Magnitudo : {d.mag}
        </li>
        <li>
          Kedalaman : {d.depth}
        </li>
        <li>
          Waktu : {new Date(d.time!).toLocaleString()}
        </li>
        <li>
          Lokasi (Lat,Lng) : <br />{d.lat} , {d.lng}
        </li>
      </ul>
    </Card>);

    selectedPopup.current = new AnimatedPopup({
      closeOnClick: false,
      openingAnimation: {
        duration: 100,
        easing: 'easeOutSine',
        transform: 'scale'
      },
      closingAnimation: {
        duration: 100,
        easing: 'easeInOutSine',
        transform: 'scale'
      }
    }).setDOMContent(placeholder).setLngLat([d.lng, d.lat]).addTo(map.current!);
    const cekTable = document.querySelector("#histori_tabel tbody");
    if (cekTable) {
      cekTable.innerHTML = "<tr></tr>";
    }
    setTimeout(() => {
      readTextFile("https://bmkg-content-inatews.storage.googleapis.com/history." + d.id + ".txt");
    }, 500);
  }

  function testDemoGempa() {
    if (geoJsonData.current == null) {
      alert("Wait loading geojson");
      return;
    };
    const bbox = turf.bbox(geoJsonData.current);
    const randomPosition = turf.randomPosition(bbox);
    const mag = (Math.random() * (10 - 5) + 5).toFixed(1);
    const depth = (Math.random() * 20).toFixed(1) + " Km";
    const message = "Gempa Bumi Test Pada Lokasi : Lat : " + randomPosition[1] + " Lng : " + randomPosition[0] + " Magnitudo : " + mag + " Kedalaman : " + depth;
    const id = `tg-${new Date().getTime()}`;

    const dt = DateTime.now();
    const readAbleTime = dt.toISODate() + " " + dt.toLocaleString(DateTime.TIME_24_WITH_SECONDS)
    const nig: InfoGempa = {
      id: id,
      lng: randomPosition[0],
      lat: randomPosition[1],
      mag: parseFloat(mag),
      depth: depth || "10 Km",
      message: message,
      time: readAbleTime
    };


    warningHandler({
      id: id,
      lng: randomPosition[0],
      lat: randomPosition[1],
      mag: mag,
      depth: depth,
      message: message,
      time: readAbleTime
    });

    // setTimeout(() => {
    //   setInfoGempaDirasakanTerakhir(nig);
    // }, 6000);

  }

  function readTextFile(e: string) {

    var t = new XMLHttpRequest;
    t.open("GET", e, !1), t.onreadystatechange = function () {
      if (4 === t.readyState && (200 === t.status || 0 == t.status)) {
        let u = t.responseText.split("\n");
        var table = document.getElementById("histori_tabel") as HTMLTableElement;
        //clear tbody

        let T = u.length - 1;
        for (let t = 1; t < T; t++) {
          let T = u[t].split("|");
          var n = table.insertRow(t),
            a = n.insertCell(0),
            l = n.insertCell(1),
            s = n.insertCell(2),
            i = n.insertCell(3),
            o = n.insertCell(4),
            r = n.insertCell(5),
            d = n.insertCell(6),
            m = n.insertCell(7),
            g = n.insertCell(8),
            c = n.insertCell(9);
          a.innerHTML = T[0], l.innerHTML = T[1], s.innerHTML = T[2], i.innerHTML = T[3], o.innerHTML = T[4], r.innerHTML = T[5], d.innerHTML = T[6], m.innerHTML = T[7], g.innerHTML = T[8], c.innerHTML = T[9]
        }
      }
    }, t.send(null)
  }


  return (
    <div>
      <audio id="danger" className='hidden'>
        <source src={dangerSound} type="audio/mp3" />
      </audio>

      <div ref={mapContainer} className="w-full h-screen" />

      {!loadingScreen && stackAlert && <Card title={
        <div className='overflow-hidden'>
          <div className='strip-wrapper '><div className='strip-bar loop-strip-reverse anim-duration-20'></div><div className='strip-bar loop-strip-reverse anim-duration-20'></div></div>
          <div className='absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center'>
            <p className='p-1 bg-black font-bold text-xs text-glow'>GEMPA BUMI</p>
          </div>
        </div>
      } className='hidden md:block show-pop-up  fixed top-12 md:top-6 left-0 card-float right-0 md:left-6 md:w-1/3 lg:w-1/4 xl:w-1/5 2xl:w-1/6'>
        <div className='flex flex-col w-full justify-center items-center text-glow text-sm ' style={{
          fontSize: "10px"
        }}>
          <div className='w-full flex   gap-2' >
            <div>
              <div id="internal" className="label bordered flex mb-2 w-full lg:w-32">
                <div className="flex flex-col items-center p-1 ">
                  <div className="text -characters">{stackAlert.mag}</div>
                  <div className="text">MAG</div>
                </div>
                <div className="decal -blink -striped"></div>
              </div>
              <p className='text-glow font-bold'>DEPTH : {parseFloat(stackAlert.depth.replace(" Km", "")).toFixed(2)} KM</p>
            </div>
            <div className="bordered p-2 w-full">
              <table className='w-full'>
                <tbody>

                  <tr>
                    <td className='text-left'>TIME</td>
                    <td className='text-right'>{stackAlert.time} WIB</td>
                  </tr>
                  <tr>
                    <td className='text-left'>MAG</td>
                    <td className='text-right'>{stackAlert.mag}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>DEPTH</td>
                    <td className='text-right'>{stackAlert.depth}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>LAT</td>
                    <td className='text-right'>{stackAlert.lat}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>LNG</td>
                    <td className='text-right'>{stackAlert.lng}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
          <div className='mt-2 bordered'>
            <p className='text-glow p-2 break-words'>{stackAlert.message}</p>
          </div>
        </div>
        {stackAlert.mag >= 5 &&  <div className='red-bordered p-2 overflow-y-auto custom-scrollbar mt-2' style={{
          maxHeight: "20vh",
        }}>
          <ul>
            {stackAlert.listKotaTerdampak && stackAlert.listKotaTerdampak.map((kota, i) => {
              if (kota.hit) {
                return <li key={i} className='flex flex-grow justify-between items-center mb-2 item-daerah danger slide-in-left'>
                  <ItemKotaTerdampak kota={kota} />
                </li>
              } else {
                return <li key={i} className='flex flex-grow justify-between items-center mb-2 item-daerah slide-in-left'>
                  <ItemKotaTerdampak kota={kota} />
                </li>
              }
            })}
          </ul>
        </div>}
      </Card>}


      <div className='fixed  top-12 md:bottom-auto md:top-2 left-0 right-0 m-auto bordered w-24 text-sm text-center bg-black cursor-pointer' onClick={() => {
        testDemoGempa();
      }}>
        TEST GEMPA
      </div>


      {!loadingScreen && <Card title={
        <p className='font-bold text-glow-red text-sm text-center' style={{
          color: "red"
        }}>EVENT LOG</p>
      } className=' fixed right-0  md:right-6 top-1 md:top-6 card-float md:w-1/3 lg:w-1/5 show-pop-up'>
        <ul >
          {infoGempas.map((v: InfoGempa, i) => {

            return <li key={i}
              onClick={() => {
                selectEvent(v);

              }}
              className='flex flex-col mb-2 list-event cursor-pointer  slide-in-left' style={{
                animationDelay: `${i * 0.01}s`,
                transform: 'translateX(-110%)'
              }}>
              <span className='block mb-1' style={{
                fontSize: "11px"
              }}>{v.time} WIB</span>
              <div className=' bordered p-2 overflow-hidden' style={{
                fontSize: "12px"
              }}>
                {Number(v.mag).toFixed(2)} M - {v.place || "uknown"}
              </div>
            </li>
          })}
        </ul>

      </Card>}



      

      {!loadingScreen && infoGempaTerakhir && <Card title={
        <div className='w-full flex justify-center text-center'>
          <p className='font-bold text-glow-red text-sm '>
            GEMPA TERDETEKSI TERAKHIR
          </p>

        </div>
      }
      footer={
        <div className='flex justify-center w-full  cursor-pointer' onClick={()=>{
          selectEvent(infoGempaTerakhir);
        }}>
          <span ><IoLocationSharp /></span>
        </div>
      }

        className='hidden md:block show-pop-up fixed bottom-28 md:bottom-6 card-float left-1 right-1 m-auto md:w-1/4 lg:w-1/6'>
        <div className='text-glow text-sm w-full ' style={{
          fontSize: "10px"
        }}>
          <table className='w-full'>
            <tbody>
              <tr>
                <td className='text-left'>PLACE</td>
                <td className='text-right'>{infoGempaTerakhir.place}</td>
              </tr>
              <tr>
                <td className='text-left'>TIME</td>
                <td className='text-right' data-time={infoGempaTerakhir.time}>{infoGempaTerakhir.time} WIB</td>
              </tr>
              <tr>
                <td className='text-left'>MAG</td>
                <td className='text-right'>{infoGempaTerakhir.mag}</td>
              </tr>
              <tr>
                <td className='text-left'>DEPTH</td>
                <td className='text-right'>{parseFloat(infoGempaTerakhir.depth.replace(" Km", "")).toFixed(2)} KM</td>
              </tr>
              <tr>
                <td className='text-left'>LAT</td>
                <td className='text-right'>{infoGempaTerakhir.lat}</td>
              </tr>
              <tr>
                <td className='text-left'>LNG</td>
                <td className='text-right'>{infoGempaTerakhir.lng}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>}

      {!loadingScreen && infoGempaDirasakanTerakhir && <Card title={
        <div className='w-full flex justify-center text-center'>
          <p className='font-bold text-glow-red text-sm '>
            GEMPA DIRASAKAN TERAKHIR
          </p>

        </div>
      }
      footer={
        <div className='flex justify-center w-full cursor-pointer' onClick={()=>{
          selectEvent(infoGempaDirasakanTerakhir);
        }}>
          <span ><IoLocationSharp /></span>
        </div>
      }

        className='hidden md:block show-pop-up fixed bottom-10 left-1 right-1 md:right-0 md:left-6 card-float  md:w-1/3 lg:w-1/4 xl:w-1/5 2xl:w-1/6'>
        <div className='flex flex-col w-full justify-center items-center text-glow text-sm ' style={{
          fontSize: "10px"
        }}>
          <div className='w-full flex   gap-2' >
            <div>
              <div id="internal" className="label bordered flex mb-2 w-full lg:w-32">
                <div className="flex flex-col items-center p-1 ">
                  <div className="text -characters">{infoGempaDirasakanTerakhir.mag}</div>
                  <div className="text">MAG</div>
                </div>
                <div className="decal -blink -striped"></div>
              </div>
              <p className='text-glow font-bold'>DEPTH : {parseFloat(infoGempaDirasakanTerakhir.depth.replace(" Km", "")).toFixed(2)} KM</p>
            </div>
            <div className="bordered p-2 w-full">
              <table className='w-full'>
                <tbody>

                  <tr>
                    <td className='text-left'>TIME</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.time} WIB</td>
                  </tr>
                  <tr>
                    <td className='text-left'>MAG</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.mag}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>DEPTH</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.depth}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>LAT</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.lat}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>LNG</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.lng}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
          <div className='mt-2 bordered'>
            <p className='text-glow p-2 break-words'>{infoGempaDirasakanTerakhir.message}</p>
          </div>
        </div>
      </Card>}

      {!loadingScreen && detailInfoGempa && <Card title={
        <div className='w-full flex justify-between'>
          <p className='font-bold text-glow-red text-sm'>
            DETAIL EVENT
          </p>
          <button onClick={() => {
            if (selectedPopup.current) {
              selectedPopup.current.remove();
            }
            setDetailInfoGempa(null);
          }}>X</button>
        </div>
      }
        className='right-6 bottom-6 fixed hidden md:block  card-float  show-pop-up '>
        <div className='text-glow text-sm w-full ' style={{
          fontSize: "10px"
        }}>
          <div className='flex flex-col w-full gap-2'>
            {/* <img src={"https://bmkg-content-inatews.storage.googleapis.com/" + (detailInfoGempa.time?.replaceAll("-", "").replaceAll(" ", "").replaceAll(":", "")) + ".mmi.jpg"} alt="" className='w-52' /> */}

            <div>
              <div className='bordered p-2'>
                <table className='w-full'>
                  <tbody>
                    <tr>
                      <td className='text-left flex'>PLACE</td>
                      <td className='text-right break-words pl-2'>{detailInfoGempa.place}</td>
                    </tr>
                    <tr>
                      <td className='text-left flex'>TIME</td>
                      <td className='text-right break-words pl-2' data-time={detailInfoGempa.time}>{detailInfoGempa.time} WIB</td>
                    </tr>
                    <tr>
                      <td className='text-left flex'>MAG</td>
                      <td className='text-right break-words pl-2'>{detailInfoGempa.mag}</td>
                    </tr>
                    <tr>
                      <td className='text-left flex'>DEPTH</td>
                      <td className='text-right break-words pl-2'>{parseFloat(detailInfoGempa.depth.replace(" Km", "")).toFixed(2)} KM</td>
                    </tr>
                    <tr>
                      <td className='text-left flex'>LAT</td>
                      <td className='text-right break-words pl-2'>{detailInfoGempa.lat}</td>
                    </tr>
                    <tr>
                      <td className='text-left flex'>LNG</td>
                      <td className='text-right break-words pl-2'>{detailInfoGempa.lng}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className='bordered p-2'>
              <table id='histori_tabel' style={{
                fontSize: "10px"
              }} className='w-full text-right'>
                <thead>
                  <tr>
                    <th className='p-1'>
                      Time(UTC)
                    </th>
                    <th className='p-1'>
                      +OT(min)
                    </th>
                    <th className='p-1'>
                      Lat
                    </th>
                    <th className='p-1'>
                      Lng
                    </th>
                    <th className='p-1'>
                      Depth
                    </th>
                    <th className='p-1'>
                      Phase
                    </th>
                    <th className='p-1'>
                      MagType
                    </th>
                    <th className='p-1'>
                      Mag
                    </th>
                    <th className='p-1'>
                      MagCount
                    </th>
                    <th className='p-1'>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </Card>}

      {!loadingScreen && stackAlert && infoGempaDirasakanTerakhir && <Card title={
        <div className='overflow-hidden'>
          <div className='strip-wrapper '><div className='strip-bar loop-strip-reverse anim-duration-20'></div><div className='strip-bar loop-strip-reverse anim-duration-20'></div></div>
          <div className='absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center'>
            <p className='p-1 bg-black font-bold text-xs text-glow'>GEMPA BUMI</p>
          </div>
        </div>
      } className='block md:hidden show-pop-up  fixed bottom-10 md:top-6 left-0 card-warning right-0 md:left-6 md:w-1/4 lg:w-1/5'>
        <div className='flex flex-col w-full justify-center items-center text-glow text-sm ' style={{
          fontSize: "10px"
        }}>
          <div className='w-full flex   gap-2' >
            <div>
              <div id="internal" className="label bordered flex mb-2 w-full lg:w-32">
                <div className="flex flex-col items-center p-1 ">
                  <div className="text -characters">{infoGempaDirasakanTerakhir.mag}</div>
                  <div className="text">MAG</div>
                </div>
                <div className="decal -blink -striped"></div>
              </div>
              <p className='text-glow font-bold'>DEPTH : {parseFloat(infoGempaDirasakanTerakhir.depth.replace(" Km", "")).toFixed(2)} KM</p>
            </div>
            <div className="bordered p-2 w-full">
              <table className='w-full'>
                <tbody>

                  <tr>
                    <td className='text-left'>TIME</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.time} WIB</td>
                  </tr>
                  <tr>
                    <td className='text-left'>MAG</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.mag}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>DEPTH</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.depth}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>LAT</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.lat}</td>
                  </tr>
                  <tr>
                    <td className='text-left'>LNG</td>
                    <td className='text-right'>{infoGempaDirasakanTerakhir.lng}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
          <div className='mt-2 bordered'>
            <p className='text-glow p-2 break-words'>{infoGempaDirasakanTerakhir.message}</p>
          </div>
        </div>
        
      </Card>}

      {!loadingScreen && alertGempaBumis.map((v, i) => {
        return <div className='z-50' key={i}>
          <GempaBumiAlert
            key={i}
            props={
              {
                magnitudo: v.mag || 9.0,
                kedalaman: v.depth || '0 km',
                show: true,
                closeInSecond: 6
              }
            } />
        </div>
      })}


      <div className="fixed bottom-2 md:bottom-1 m-auto right-0 md:right-72 left-0 md:left-auto flex justify-center items-center gap-2 w-36  md:w-auto">
        <a title="Link Github" href="https://inatews.bmkg.go.id" className='flex gap-1 text-center justify-center  m-auto'>
          <div className='bmkg-icon'></div>
          <span>BMKG</span>
        </a>
        <a title="Link Github" href="https://github.com/bagusindrayana/ews-concept" className='flex gap-1 text-center justify-center  m-auto'>
          <div className='github-icon'></div>
          <span>Github</span>
        </a>

      </div>


      <div className='fixed m-auto top-0 bottom-0 left-0 right-0 flex flex-col justify-center items-center overlay-bg text-center' id='loading-screen'>
        <span className="loader"></span>
        <p className='my-2 red-color'>INI MERUPAKAN DESAIN KONSEP - DATA GEMPA DARI BMKG</p>
      </div>

    </div>

  );
}
