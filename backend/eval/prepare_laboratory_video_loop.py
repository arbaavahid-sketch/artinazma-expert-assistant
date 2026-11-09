"""Prepare a circular end-to-start dissolve without changing the source clip."""
import argparse
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np


def decode(path):
    capture = cv2.VideoCapture(str(path))
    frames = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frames.append(frame)
    capture.release()
    if not frames:
        raise ValueError('Cannot decode video')
    return frames


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    source = root/'frontend/public/videos/laboratory-equipment-glow.mp4'
    target = root/'frontend/public/videos/laboratory-equipment-glow-loop-v2.mp4'
    # Original frames 14..175, followed by tail 176..189 dissolved into head 0..13.
    # The last output frame is original frame 13, followed by frame 14 at wrap.
    weight = '(min(1,T*24/13)*min(1,T*24/13)*(3-2*min(1,T*24/13)))'
    filters = ('[0:v]split=3[body][tail][head];'
               '[body]trim=start_frame=14:end_frame=176,setpts=PTS-STARTPTS[b];'
               '[tail]trim=start_frame=176:end_frame=190,setpts=PTS-STARTPTS[t];'
               '[head]trim=start_frame=0:end_frame=14,setpts=PTS-STARTPTS[h];'
               f"[t][h]blend=all_expr='A*(1-{weight})+B*{weight}':shortest=1[x];"
               '[b][x]concat=n=2:v=1:a=0[joined];[joined]setpts=N/(24*TB)[out]')
    subprocess.run([args.ffmpeg,'-y','-hide_banner','-loglevel','error','-i',str(source),
                    '-filter_complex',filters,'-map','[out]','-an','-c:v','libx264',
                    '-preset','medium','-crf','19','-pix_fmt','yuv420p','-r','24','-fps_mode','cfr','-movflags',
                    '+faststart',str(target)],check=True)
    original, result = decode(source), decode(target)
    if len(original)!=190 or len(result)!=176:
        raise ValueError('Unexpected clip length; review the transition parameters')
    cv2.imwrite(str(root/'frontend/public/images/laboratory-equipment-glow-loop-poster.jpg'),result[0],[cv2.IMWRITE_JPEG_QUALITY,90])
    difference = lambda a,b:float(np.mean(np.abs(a.astype(np.float32)-b.astype(np.float32))))
    audit = {'sourceFrames':len(original),'loopFrames':len(result),'fps':24,'transitionFrames':14,
             'sourceBoundaryMeanAbsoluteDifference':difference(original[-1],original[0]),
             'loopBoundaryMeanAbsoluteDifference':difference(result[-1],result[0]),
             'loopLastStepMeanAbsoluteDifference':difference(result[-2],result[-1]),'bytes':target.stat().st_size,'file':target.name}
    (root/'output/laboratory-video-loop-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
    print(json.dumps(audit))


if __name__=='__main__':
    main()
