import {useId} from 'react';
/** Original vector artwork. Named joints are updated by the procedural rig, not React frames. */
export function Character(){
  const id=useId().replaceAll(':','');
  return <svg viewBox="0 0 220 230" className="nimbo-art" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id+'fur'} x1=".15" y1="0" x2=".85" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#818b96"/><stop offset=".45" stopColor="#4e5865"/><stop offset="1" stopColor="#252e39"/></linearGradient>
      <linearGradient id={id+'face'} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#f7f1dc"/><stop offset="1" stopColor="#c9c4b6"/></linearGradient>
      <linearGradient id={id+'tail'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#687381"/><stop offset="1" stopColor="#222c37"/></linearGradient>
      <radialGradient id={id+'iris'}><stop stopColor="#d5c693"/><stop offset="1" stopColor="#887a50"/></radialGradient>
    </defs>
    <ellipse data-joint="shadow" cx="109" cy="211" rx="58" ry="8" fill="#000" opacity=".2"/>
    <g data-joint="body" stroke="#29323d" strokeWidth="1.7" strokeLinejoin="round">
      <g data-joint="tail"><path d="M138 176C163 176 163 157 160 140C157 118 172 108 188 117C211 130 203 161 190 179C179 195 156 203 138 194Z" fill={'url(#'+id+'tail)'}/><path d="M180 115C188 113 198 121 200 133L189 128L188 139L176 134L172 142C165 135 164 125 170 119Z" fill="#d5cfb9"/><path d="M163 171Q181 158 183 142" fill="none" stroke="#a6a99f" strokeOpacity=".3"/></g>
      <g data-joint="footL"><path d="M75 190C68 192 60 201 65 207C71 214 91 212 96 205L95 190" fill="#414c59"/><path d="M70 205l2-4m7 6 1-5" fill="none" stroke="#909a9e"/></g>
      <g data-joint="footR"><path d="M120 191L120 205C129 214 149 212 151 206C155 199 146 191 139 189" fill="#414c59"/><path d="m135 207-1-5m9 3-2-5" fill="none" stroke="#909a9e"/></g>
      <path d="M76 121C62 141 63 170 70 190Q77 206 106 205Q142 205 147 183C151 163 148 138 133 123Z" fill={'url(#'+id+'fur)'}/>
      <path d="M86 139Q108 129 130 140L135 172Q137 190 112 194Q85 193 81 174Z" fill={'url(#'+id+'face)'} stroke="none"/>
      <path d="m95 149 7 8 6-8 7 8 7-8" fill="none" stroke="#a9a697" strokeWidth="1.5"/>
      <g data-joint="armL"><path d="M77 139C63 136 56 151 59 169Q61 181 71 177L82 157" fill={'url(#'+id+'fur)'}/><path d="m62 170 3-5m3 8 2-5" stroke="#a6adaf" fill="none"/></g>
      <g data-joint="armR"><path d="M138 139C150 139 158 151 154 169Q150 181 142 176L132 157" fill={'url(#'+id+'fur)'}/><path d="m150 169-3-4m-3 8-2-5" stroke="#a6adaf" fill="none"/></g>
      <g data-joint="head">
        <g data-joint="earL"><path d="M72 75C52 65 46 35 60 28C78 22 91 51 89 67Z" fill={'url(#'+id+'fur)'}/><path d="M69 63C58 52 55 37 62 36Q75 36 80 61Z" fill="#bd9f9a" stroke="none"/><path d="m57 32 3-10 7 7" fill="#8e979e" stroke="none"/></g>
        <g data-joint="earR"><path d="M126 66C126 45 143 27 155 35Q166 44 147 77Z" fill={'url(#'+id+'fur)'}/><path d="M136 64Q144 39 153 42Q157 48 144 67" fill="#bd9f9a" stroke="none"/></g>
        <path d="M58 92Q54 67 78 57L82 49L89 54L97 45L102 53Q129 49 147 66Q165 80 159 103L168 108L156 115L160 123L147 125Q141 143 109 146Q75 144 64 129L54 126L59 116L49 111L59 104Z" fill={'url(#'+id+'fur)'}/>
        <path d="M65 99C65 83 83 77 95 86L108 100L121 85C136 77 150 86 151 101Q158 124 134 135Q109 148 84 134Q61 125 65 99Z" fill={'url(#'+id+'face)'} stroke="none"/>
        <path d="m78 68 6-3m46 4 6 4M97 60l5 3" stroke="#a1a9ae" strokeLinecap="round"/>
        <g data-joint="browL"><path d="M73 83Q83 76 94 83" fill="none" stroke="#27323d" strokeWidth="3" strokeLinecap="round"/></g>
        <g data-joint="browR"><path d="M121 82Q134 77 143 84" fill="none" stroke="#27323d" strokeWidth="3" strokeLinecap="round"/></g>
        <g data-joint="eyeL"><ellipse cx="85" cy="99" rx="12" ry="16" fill="#fff9e9" stroke="none"/><g data-joint="pupilL"><ellipse cx="87" cy="101" rx="8.5" ry="12" fill={'url(#'+id+'iris)'}/><ellipse cx="88" cy="102" rx="5.3" ry="9" fill="#18222b" stroke="none"/><circle cx="84" cy="96" r="3.2" fill="white" stroke="none"/><circle cx="90" cy="106" r="1.2" fill="white" stroke="none"/></g></g>
        <g data-joint="eyeR"><ellipse cx="132" cy="99" rx="12" ry="16" fill="#fff9e9" stroke="none"/><g data-joint="pupilR"><ellipse cx="130" cy="101" rx="8.5" ry="12" fill={'url(#'+id+'iris)'}/><ellipse cx="130" cy="102" rx="5.3" ry="9" fill="#18222b" stroke="none"/><circle cx="127" cy="96" r="3.2" fill="white" stroke="none"/><circle cx="133" cy="106" r="1.2" fill="white" stroke="none"/></g></g>
        <path d="M99 115Q108 109 117 115Q117 121 109 123Q101 122 99 115Z" fill="#2b333c" stroke="none"/><path d="M103 114h5" stroke="#68717c" strokeLinecap="round"/>
        <path data-joint="mouth" d="M97 125Q109 133 121 125" stroke="#4d4d46" strokeWidth="2.3" strokeLinecap="round" fill="none"/>
        <path d="m74 119-12-2m13 6-10 2m78-6 12-2m-12 6 10 2" stroke="#8a887d" strokeWidth="1.2" strokeLinecap="round"/>
        <ellipse cx="76" cy="117" rx="7" ry="3" fill="#c9998c" opacity=".35" stroke="none"/><ellipse cx="141" cy="117" rx="7" ry="3" fill="#c9998c" opacity=".35" stroke="none"/>
      </g>
    </g>
    <g data-joint="spark" fill="none" stroke="#bcad83" strokeWidth="2" opacity="0"><path d="m37 76 0 10m-5-5h10M183 65v10m-5-5h10M174 41v7m-4-3h8"/></g>
    <g data-joint="sleep" opacity="0" fill="none" stroke="#a4a8ae" strokeWidth="2" strokeLinecap="round"><path d="M165 58h8l-8 9h8m5-28h12l-12 13h12"/></g>
  </svg>;
}
