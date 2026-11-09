"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import styles from './laboratory-artwork.module.css';

export default function LaboratoryArtwork({en,requestedMotion=false}:{en:boolean;calculationRevision?:number;requestedMotion?:boolean}){
  const root=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement|null>(null);
  const shouldPlay=useRef(false),failed=useRef(false);
  const [activated,setActivated]=useState(false);
  const bindVideo=useCallback((node:HTMLVideoElement|null)=>{
    if(video.current&&video.current!==node)video.current.pause();
    video.current=node;
    if(node&&shouldPlay.current){try{void node.play()?.catch(()=>{});}catch{/* Keep the poster if autoplay is unavailable. */}}
  },[]);
  useEffect(()=>{
    const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const connection=(navigator as Navigator&{connection?:EventTarget&{saveData?:boolean}}).connection;
    let inView=typeof IntersectionObserver==='undefined';
    function sync(){
      const allowed=(requestedMotion||motion?.matches===false)&&!connection?.saveData&&!failed.current;
      const playing=allowed&&inView&&document.visibilityState==='visible';
      shouldPlay.current=playing;
      if(!allowed)setActivated(false);else if(playing)setActivated(true);
      const node=video.current;
      if(!node)return;
      if(!playing)node.pause();else if(node.paused){try{void node.play()?.catch(()=>{});}catch{/* The poster remains visible. */}}
    }
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{for(const entry of entries)if(entry.target===root.current){inView=entry.isIntersecting;sync();}},{threshold:0});
    if(root.current)observer?.observe(root.current);
    motion?.addEventListener('change',sync);
    connection?.addEventListener('change',sync);
    document.addEventListener('visibilitychange',sync);
    sync();
    return()=>{observer?.disconnect();motion?.removeEventListener('change',sync);connection?.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);shouldPlay.current=false;video.current?.pause();};
  },[requestedMotion]);
  return <div ref={root} className={styles.artwork} role="img" aria-label={en?'Laboratory equipment':'تجهیزات آزمایشگاهی'}>
    {activated?<video ref={bindVideo} className={styles.video} width={1280} height={720} muted loop playsInline controls={false} disablePictureInPicture disableRemotePlayback preload="metadata" poster="/images/laboratory-equipment-glow-loop-poster.jpg" aria-hidden="true" tabIndex={-1} onError={()=>{failed.current=true;shouldPlay.current=false;setActivated(false);}}>
      <source src="/videos/laboratory-equipment-glow-loop-v2.mp4" type="video/mp4"/>
    </video>:<img className={styles.video} src="/images/laboratory-equipment-glow-loop-poster.jpg" width={1280} height={720} alt="" aria-hidden="true"/>}
  </div>;
}
