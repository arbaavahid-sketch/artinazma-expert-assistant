import React from 'react';
import {act,cleanup,fireEvent,render} from '@testing-library/react';
import {beforeEach,afterEach,expect,it,vi,type Mock} from 'vitest';
import LaboratoryArtwork from './calculators/LaboratoryArtwork';

let motion:EventTarget&{matches:boolean};
let connection:EventTarget&{saveData:boolean};
let intersect:(entries:IntersectionObserverEntry[])=>void;
let disconnect:Mock<() => void>;
let play:ReturnType<typeof vi.spyOn>,pause:ReturnType<typeof vi.spyOn>;
function visible(container:HTMLElement,value=true){act(()=>intersect([{target:container.firstElementChild,isIntersecting:value} as IntersectionObserverEntry]));}
function changeVisibility(value:'hidden'|'visible'){Object.defineProperty(document,'visibilityState',{configurable:true,value});act(()=>document.dispatchEvent(new Event('visibilitychange')));}
beforeEach(()=>{
 motion=Object.assign(new EventTarget(),{matches:false});connection=Object.assign(new EventTarget(),{saveData:false});disconnect=vi.fn();
 vi.stubGlobal('matchMedia',vi.fn(()=>motion));
 Object.defineProperty(navigator,'connection',{configurable:true,value:connection});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 vi.stubGlobal('IntersectionObserver',class {constructor(callback:(entries:IntersectionObserverEntry[])=>void){intersect=callback;}observe(){}disconnect(){disconnect();}});
 play=vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();pause=vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();delete (navigator as Navigator&{connection?:unknown}).connection;delete (document as unknown as {visibilityState?:string}).visibilityState;});

it('exposes only a poster until the artwork actually enters the viewport',()=>{
 const {container}=render(<LaboratoryArtwork en={false}/>);expect(container.querySelector('video')).toBeNull();expect(container.querySelector('source')).toBeNull();expect(container.querySelector('img')).toHaveAttribute('src','/images/laboratory-equipment-glow-loop-poster.jpg');
 visible(container);const video=container.querySelector('video')!;expect(video).toHaveProperty('muted',true);expect(video).toHaveProperty('loop',true);expect(video).toHaveProperty('controls',false);expect(play).toHaveBeenCalled();expect(container.querySelectorAll('button')).toHaveLength(0);
});
it('plays on explicit request with reduced motion while retaining data-saving and offscreen behavior',()=>{
 motion.matches=true;const {container}=render(<LaboratoryArtwork en requestedMotion/>);visible(container);expect(container.querySelector('video')).not.toBeNull();expect(play).toHaveBeenCalled();pause.mockClear();visible(container,false);expect(pause).toHaveBeenCalled();act(()=>{connection.saveData=true;connection.dispatchEvent(new Event('change'));});expect(container.querySelector('video')).toBeNull();
});
it('never attaches the MP4 source when reduced motion or save-data is already requested',()=>{
 motion.matches=true;const first=render(<LaboratoryArtwork en/>);visible(first.container);expect(first.container.querySelector('source')).toBeNull();expect(play).not.toHaveBeenCalled();first.unmount();motion.matches=false;connection.saveData=true;const second=render(<LaboratoryArtwork en/>);visible(second.container);expect(second.container.querySelector('video')).toBeNull();expect(play).not.toHaveBeenCalled();
});
it('pauses offscreen and resumes the same video without resetting its playback position',()=>{
 const {container}=render(<LaboratoryArtwork en/>);visible(container);const video=container.querySelector('video')!;video.currentTime=2.5;pause.mockClear();visible(container,false);expect(pause).toHaveBeenCalled();expect(container.querySelector('video')).toBe(video);visible(container);expect(video.currentTime).toBe(2.5);expect(container.querySelector('video')).toBe(video);
});
it('does not activate in a hidden tab and pauses again when a playing tab becomes hidden',()=>{
 changeVisibility('hidden');const {container}=render(<LaboratoryArtwork en/>);visible(container);expect(container.querySelector('source')).toBeNull();changeVisibility('visible');expect(container.querySelector('video')).not.toBeNull();pause.mockClear();changeVisibility('hidden');expect(pause).toHaveBeenCalled();
});
it('responds to preference changes with a poster and can resume after the restriction is removed',()=>{
 const {container}=render(<LaboratoryArtwork en/>);visible(container);act(()=>{motion.matches=true;motion.dispatchEvent(new Event('change'));});expect(container.querySelector('source')).toBeNull();act(()=>{motion.matches=false;motion.dispatchEvent(new Event('change'));});expect(container.querySelector('video')).not.toBeNull();act(()=>{connection.saveData=true;connection.dispatchEvent(new Event('change'));});expect(container.querySelector('video')).toBeNull();
});
it('keeps a stable poster after a media error and ignores further visibility notifications',()=>{
 const {container}=render(<LaboratoryArtwork en/>);visible(container);fireEvent.error(container.querySelector('video')!);expect(container.querySelector('video')).toBeNull();visible(container,false);visible(container);expect(container.querySelector('source')).toBeNull();
});
it('catches denied autoplay and cleans up observers and listeners on unmount',async()=>{
 play.mockRejectedValue(Error('autoplay denied'));const {container,unmount}=render(<LaboratoryArtwork en/>);visible(container);await act(async()=>{});expect(container.querySelector('video')).not.toBeNull();unmount();expect(disconnect).toHaveBeenCalledOnce();play.mockClear();act(()=>motion.dispatchEvent(new Event('change')));changeVisibility('visible');expect(play).not.toHaveBeenCalled();
});
