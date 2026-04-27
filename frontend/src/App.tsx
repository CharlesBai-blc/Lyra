import { FormEvent, useState, useEffect,useRef } from 'react'
import './App.css'
import { SongRecommendation } from './types'
import { FaSpotify } from 'react-icons/fa'
import clickFile from './assets/click.mp3'
import errorFile from './assets/eror.mp3'
import selectFile from './assets/select.mp3'
import middleFile from './assets/minimize.wav'
import boomFile from './assets/vine-boom.mp3'
import transportFile from './assets/click.wav'
import confirmFile from './assets/confirmation_002.ogg'
import closeFile from './assets/closesound.wav'
import heartFile from './assets/heart.ogg'
import listFile from './assets/list.ogg'
import { BsSkipBackwardFill, BsSkipStartFill, BsSkipEndFill, BsSkipForwardFill, BsFillPlayFill, BsFillPauseFill, BsSuitHeartFill, BsVolumeUpFill, BsVolumeMuteFill, BsVolumeDownFill } from 'react-icons/bs'
import { CursorTrail } from './CursorTrail'
import { forwardRef } from 'react' 
import bookIcon from './assets/book.svg'

const soundCache: Record<string, HTMLAudioElement> = {}

function preloadSound(file: string, volume: number) {
  const audio = new Audio(file)
  audio.volume = volume
  audio.load() // tells browser to fetch & buffer it now
  soundCache[file] = audio
}

preloadSound(clickFile, 0.4)
preloadSound(errorFile, 0.35)
preloadSound(selectFile, 0.6)
preloadSound(transportFile, 0.4)
preloadSound(middleFile, 0.4)
preloadSound(boomFile, 0.5)
preloadSound(confirmFile, 0.5)
preloadSound(heartFile, 0.2)
preloadSound(closeFile, 0.2)
preloadSound(listFile, 0.3)

function playSound(file: string) {
  if (isMuted) return
  const audio = soundCache[file]
  if (!audio) return
  audio.currentTime = 0
  audio.play().catch(() => {})
}


type TabType = 'home' | 'setup' | 'search'
type SearchMode = 'tfidf' | 'svd' | 'rag'

const SCORE_BLEND_W_TF_IDF = 0.65
const SCORE_BLEND_W_MUSIC = 0.20
const SCORE_BLEND_W_SVD = 0.15

function blendSlotPct(part: number | undefined, weight: number): number {
  if (part == null || weight <= 0) return 0
  return Math.min(100, Math.max(0, (part / weight) * 100))
}

interface Tab {
  id: string
  label: string
  type: TabType
  mode: SearchMode | null
  query: string
  songs: SongRecommendation[]
  descriptions: string[]
  error: string
  loading: boolean
  expandedQuery: string
  summary: string
}

const featureInfo: Record<string, string> = {
  Danceability: "how easy it is to dance to the song — a steady beat, clear rhythm, and lots of groove",
  Energy: "how intense the song feels - from calm and soft to loud, fast, and aggressive",
  Valence: "the mood of the song - low feels sad or dark, high feels happy or bright",
  Tempo: "how fast the song is - measured in beats per minute (BPM)"
}


function FeatureBar({ label, value, max, color, display }: {
  label: string; value: number; max: number; color: string; display?: string
}) {
  const [showTip, setShowTip] = useState(false)
  const pct = Math.round((value / max) * 100)

  function getLabel(label: string, v: number) {
    if (label === "Energy") {
      if (v < 0.3) return "Low"
      if (v < 0.7) return "Medium"
      return "High"
    }
    if (label === "Valence") {
      if (v < 0.3) return "Sad"
      if (v < 0.7) return "Neutral"
      return "Happy"
    }
    if (label === "Danceability") {
      if (v < 0.3) return "Still"
      if (v < 0.7) return "Groovy"
      return "Dancey"
    }
    return ""
  }

  return (
    <div className="feat">
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span className="feat-label">{label}</span>
        <div
          className="feat-info-wrap"
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        >
          <span className="feat-info-btn">i</span>
          {showTip && (
            <div className="feat-tooltip">{featureInfo[label]}</div>
          )}
        </div>
      </div>
      <div className="feat-bar-bg">
        <div className="feat-bar-fill"
          style={{width: `${pct}%`, background: color, opacity: 0.4 + 0.6 * (value / max)}}
        />
      </div>
      <span className="feat-val">
        <span className="feat-number">{display ?? value.toFixed(2)}</span>
        {getLabel(label, value) && (
          <span className="feat-text"> ({getLabel(label, value)})</span>
        )}
      </span>
    </div>
  )
}

function ScoreRevealBadge({ mode, song }: { mode: SearchMode; song: SongRecommendation }) {
  const [open, setOpen] = useState(false)
  const hasBlend =
    song.score_blend_tfidf != null &&
    song.score_blend_music != null &&
    song.score_blend_svd != null
  const pt = song.score_blend_tfidf ?? 0
  const pm = song.score_blend_music ?? 0
  const ps = song.score_blend_svd ?? 0
  const pctT = blendSlotPct(song.score_blend_tfidf, SCORE_BLEND_W_TF_IDF)
  const pctM = blendSlotPct(song.score_blend_music, SCORE_BLEND_W_MUSIC)
  const pctS = blendSlotPct(song.score_blend_svd, SCORE_BLEND_W_SVD)

  return (
    <div className="score-reveal-wrap">
      <span
        className={`score-badge score-badge-interactive ${open ? 'active' : ''}`}
        onClick={() => { playClick(); setOpen(p => !p) }}
      >
        {mode.toUpperCase()} Formula
      </span>
      {open && (
        <div className="score-popup">
          <div className="score-popup-titlebar">✦ match breakdown ✦</div>
          <div className="score-popup-body">
            <div className="score-popup-row">
              <span className="score-popup-label">tfidf</span>
              <div className="score-popup-bar-bg">
                <div
                  className="score-popup-bar-fill"
                  style={{ width: `${hasBlend ? pctT : 0}%`, background: '#d988b9' }}
                />
              </div>
              <span className="score-popup-pct">{hasBlend ? pt.toFixed(3) : '—'}</span>
            </div>
            <div className="score-popup-row">
              <span className="score-popup-label">music</span>
              <div className="score-popup-bar-bg">
                <div
                  className="score-popup-bar-fill"
                  style={{ width: `${hasBlend ? pctM : 0}%`, background: '#7ec8e3' }}
                />
              </div>
              <span className="score-popup-pct">{hasBlend ? pm.toFixed(3) : '—'}</span>
            </div>
            <div className="score-popup-row">
              <span className="score-popup-label">svd</span>
              <div className="score-popup-bar-bg">
                <div
                  className="score-popup-bar-fill"
                  style={{ width: `${hasBlend ? pctS : 0}%`, background: '#b59fdd' }}
                />
              </div>
              <span className="score-popup-pct">{hasBlend ? ps.toFixed(3) : '—'}</span>
            </div>
            <div className="score-popup-row score-popup-row-total">
              <span className="score-popup-label">total</span>
              <div className="score-popup-bar-bg score-popup-bar-total">
                <div
                  className="score-popup-bar-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, song.tfidf_score * 100))}%`,
                    background: '#c4a574',
                  }}
                />
              </div>
              <span className="score-popup-pct">{song.tfidf_score.toFixed(3)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WinampPlayer({ songs, descriptions, onClickSound, mode, favoriteSongs, onToggleFavorite, query }: {
  songs: SongRecommendation[]
  descriptions: string[]
  onClickSound: () => void
  mode: SearchMode
  favoriteSongs: SongRecommendation[]
  onToggleFavorite: (song: SongRecommendation) => void
  expandedQuery: string
  query: string
}) {
  console.log("WinampPlayer query prop:", query)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.75)
  const [showVolume, setShowVolume] = useState(false)
  const song = songs[selectedIndex]
  const [artUrl, setArtUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const cleanArtistName = (artist: string) => artist.replace(/[\[\]']/g, '')

  useEffect(() => {
    setArtUrl(null)
    setPreviewUrl(null)
    setIsPlaying(false)
    audioRef.current?.pause()
    fetchTrackData(song.artist, song.title).then(({ art, preview }) => {
      setArtUrl(art)
      setPreviewUrl(preview)
    })
    if (audioRef.current) audioRef.current.volume = volume
  }, [song.artist, song.title])

  const goTo = (index: number) => {
    setSelectedIndex(index)
    setIsPlaying(false)
    audioRef.current?.pause()
  }

  const prev = () => goTo(Math.max(0, selectedIndex - 1))
  const next = () => goTo(Math.min(songs.length - 1, selectedIndex + 1))

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(p => !p)
  }

  const withTransform = (f: () => void) => () => {
    playTransform()
    f()
  }
  return (
    <div className="winamp-wrap">
      <div className="winamp-playlist">
        <div className="winamp-playlist-header">✦ playlist ✦</div>
        <div className="winamp-playlist-items">
          {songs.map((s, i) => (
            <button
              key={s.id}
              className={`winamp-playlist-item ${i === selectedIndex ? 'active' : ''}`}
              onClick={() => goTo(i)}
            >
              <span className="wpi-num">{i + 1}</span>
              <span className="wpi-info">
                <span className="wpi-title">
                  {favoriteSongs.find(f => f.id === s.id) && (
                    <BsSuitHeartFill size={10} style={{ color: '#ff4dab', marginRight: '4px', verticalAlign: 'middle' }} />
                  )}
                  {s.title}
                </span>
                <span className="wpi-artist">{cleanArtistName(s.artist)}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="winamp-playlist-footer">
          brought to you by <span>{mode}</span>
        </div>
      </div>

      <div className="winamp-main">
        <div className="winamp-card">
          {previewUrl && <audio ref={audioRef} src={previewUrl} />}
          <div className="winamp-card-header">
            <div className="winamp-card-header-inner">
              <div className="winamp-album-art-wrap">
                {artUrl && (
                  <img className="winamp-album-art" src={artUrl} />
                )}
              </div>
              <div className="winamp-card-header-text">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="winamp-song-title">{song.title}</div>
                </div>
                <div className="winamp-song-meta">{cleanArtistName(song.artist)}  ✧  {song.album}</div>
                {/* {(mode === 'rag' || mode === 'svd') && ( */}
                {(mode === 'svd') && (
                  <div className="rag-info-wrap">
                    <span className="rag-info-btn">?</span>
                    <div className="rag-tooltip">
                      <div className="rag-tooltip-query-label">✦ your query ✦</div>
                      <div className="rag-tooltip-query-box">
                        {query}
                      </div>
                      <div className="rag-tooltip-desc">
                        {descriptions[selectedIndex] ? descriptions[selectedIndex] : (
                          <div className="song-summary-ghost">
                            <div className="song-summary-ghost-line" style={{ width: '92%' }} />
                            <div className="song-summary-ghost-line" style={{ width: '85%' }} />
                            <div className="song-summary-ghost-line" style={{ width: '75%' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="winamp-score-row">
                {mode === 'tfidf' ? (
                  <span className="score-badge">{song.tfidf_score.toFixed(3)} match</span>
                ) : (
                  <div className="winamp-score-row-svd" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="score-badge">{song.tfidf_score.toFixed(3)} match</span>
                    <ScoreRevealBadge mode={mode} song={song} />
                  </div>
                )}
                <a className="spotify-btn" href={song.spotify_url} target="_blank" rel="noreferrer" onClick={onClickSound}>
                  <FaSpotify />
                  <span className="spotify-text">Spotify</span>
                </a>
              </div>
            </div>
          </div>

          <div className="winamp-card-body">
            <div className="winamp-card-left">
              <div className="features-col">
                <FeatureBar label="Danceability" value={song.danceability} max={1} color="#d988b9" />
                <FeatureBar label="Energy" value={song.energy} max={1} color="#7ec8e3" />
                <FeatureBar label="Valence" value={song.valence} max={1} color="#b59fdd" />
                <FeatureBar label="Tempo" value={song.tempo} max={200} color="#f7a8c4" display={`${Math.round(song.tempo)} BPM`} />
              </div>
            </div>
            <div className="winamp-card-right">
              {song.lyrics_full && (
                <div className="lyrics-container">
                  <div className="lyrics-notes">
                    {['♪','♫','♩','♬','♪','♫','♩','♬'].map((note, i) => (
                      <span key={i} className="lyrics-note" style={{
                        left: i % 2 === 0 ? `${2 + (i % 3) * 4}%` : `${88 + (i % 3) * 3}%`,
                        animationDelay: `${i * 0.6}s`,
                        animationDuration: `${3 + (i % 3)}s`,
                        fontSize: `${11 + (i % 3) * 3}px`
                      }}>{note}</span>
                    ))}
                  </div>
                  <div className="lyrics-full">{song.lyrics_full}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="winamp-controls">
          <button
            className={`wc-btn wc-heart ${favoriteSongs.find(s => s.id === song.id) ? 'active' : ''}`}
            onClick={() => { playHeart(); onToggleFavorite(song) }}>
            <BsSuitHeartFill size={14} />
          </button>
          <button className="wc-btn" onClick={withTransform(() => goTo(0))}><BsSkipBackwardFill size={16} /></button>
          <button className="wc-btn" onClick={withTransform(prev)} disabled={selectedIndex === 0}><BsSkipStartFill size={16} /></button>
          <button className="wc-btn wc-play" onClick={togglePlay}>
            {isPlaying ? <BsFillPauseFill size={20} /> : <BsFillPlayFill size={20} />}
          </button>
          <button className="wc-btn" onClick={withTransform(next)} disabled={selectedIndex === songs.length - 1}><BsSkipEndFill size={16} /></button>
          <button className="wc-btn" onClick={withTransform(() => goTo(songs.length - 1))}><BsSkipForwardFill size={16} /></button>
          <div className="wc-volume-wrap">
            <button className={`wc-btn ${showVolume ? 'active' : ''}`} onClick={withTransform(() => setShowVolume(p => !p))}>
              {volume === 0 ? <BsVolumeMuteFill size={14} /> : volume < 0.5 ? <BsVolumeDownFill size={14} /> : <BsVolumeUpFill size={18} />}
            </button>
            {showVolume && (
              <div className="wc-volume-popup">
                <span className="wc-vol-label">VOL {Math.round(volume * 100)}</span>
                <div className="wc-vol-slider-wrap">
                  <input
                    type="range" min={0} max={1} step={0.01} value={volume}
                    className="wc-vol-slider"
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setVolume(v)
                      if (audioRef.current) audioRef.current.volume = v
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ----- helpers -----

let isMuted = false
try { isMuted = localStorage.getItem('lyra-muted') === '1' } catch {}
const muteListeners = new Set<() => void>()
function setMuted(v: boolean) {
  isMuted = v
  try { localStorage.setItem('lyra-muted', v ? '1' : '0') } catch {}
  muteListeners.forEach(l => l())
}
function subscribeMute(fn: () => void) {
  muteListeners.add(fn)
  return () => { muteListeners.delete(fn) }
}

function playClick() {
  playSound(clickFile)
}
function playTransform() {
  playSound(transportFile)
}
function playError() {
  playSound(errorFile)  
}
function playSelect() {
  playSound(selectFile)
}
function playMiddle() {
  playSound(middleFile)
}
function playBoom() {
  playSound(boomFile)
}
function playConfirm() {
  playSound(confirmFile)
}
function playHeart() {
  playSound(heartFile)
}

function playClosed() {
  playSound(closeFile)
}

function playListSound() {
  playSound(listFile)
}


function MuteButton() {
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => subscribeMute(() => setMutedState(isMuted)), [])
  return (
    <button className="retro-ctrl" onClick={() => setMuted(!muted)}>
      {muted ? <BsVolumeMuteFill /> : <BsVolumeUpFill />}
    </button>
  )
}

async function fetchTrackData(artist: string, title: string): Promise<{ art: string | null, preview: string | null }> {
  try {
    const query = encodeURIComponent(`${artist} ${title}`)
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`)
    const data = await res.json()
    if (data.results.length === 0) return { art: null, preview: null }
    return {
      art: data.results[0].artworkUrl100.replace('100x100', '600x600'),
      preview: data.results[0].previewUrl ?? null
    }
  } catch {
    return { art: null, preview: null }
  }
}

// how it works modal----

const HowItWorksModal = forwardRef<HTMLDivElement, { onClose: () => void }>(
  function HowItWorksModal({ onClose }, ref) {
    const [closing, setClosing] = useState(false)

    const handleClose = () => {
      setClosing(true)
      setTimeout(() => onClose(), 300)
    }
  return (
    <div className={`hiw-inline ${closing ? 'closing' : ''}`} ref={ref}>
      <div className="hiw-inline-header">
        <span className="hiw-inline-title">✦ how lyra finds your songs ✦</span>
        <button className="hiw-inline-close" onClick={() => {playClosed();handleClose()}}>✕</button>
      </div>
      <div className="hiw-body">
        <p className="hiw-intro">
          Describe how you're feeling and Lyra finds the soundtrack.
          TF-IDF matches your exact words to lyrics fast, great for simple emotions like "sad" or "angry".
          SVD goes deeper, translating poetic phrases like "I feel like I'm dissolving"
          into emotion terms before searching. RAG is the most powerful: it hands your
          description to an LLM that reasons through each song and explains why it fits.
          All modes tune results to your mood, quietly avoiding songs that don't match the vibe.
        </p>
        {[
          {
            chip: 'TF-IDF', name: 'keyword matching', badge: 'fastest', badgeClass: 'hiw-badge-fast',
            steps: ['tokenizes your query into keywords', 'rare emotional words score higher', 'songs ranked by lyric overlap'],
            formula: null,
          },
          {
            chip: 'SVD', name: 'vibe shape matching', badge: 'smarter', badgeClass: 'hiw-badge-smart',
            steps: ['maps your words to emotion anchors', '"dissolving" → "numb, drifting, detached"', 'matches songs by emotional shape + audio features'],
            formula: 'Formula: 65% tfidf  ✦  20% audio  ✦  15% svd',
          },
          {
            chip: 'RAG', name: 'AI-powered search', badge: 'deepest', badgeClass: 'hiw-badge-deep',
            steps: ['TF-IDF + SVD fetch a candidate pool', 'an LLM reasons over each song', 'returns results + a personalized why-it-fits explanation'],
            formula: 'Modified query → SVD formula → LLM song summary',
          },
        ].map(m => (
          <div className="hiw-section" key={m.chip}>
            <div className="hiw-section-header">
              <span className="hiw-chip">{m.chip}</span>
              <span className="hiw-mode-name">{m.name}</span>
              <span className={`hiw-badge ${m.badgeClass}`}>{m.badge}</span>
            </div>
            <div className="hiw-section-body">
              <div className="hiw-steps">
                {m.steps.map((s, i) => (
                  <div className="hiw-step" key={i}>
                    <span className="hiw-step-num">{i + 1}</span>
                    <span className="hiw-step-text">{s}</span>
                  </div>
                ))}
              </div>
              {m.formula && (
                <div className="hiw-formula">{m.formula}</div>
              )}
            </div>
          </div>
        ))}
        <p className="hiw-footnote">✦ 10k+ songs with lyrics & audio features ✦</p>
      </div>
    </div>
  )
})

// ---- glitch in home ----

function GlitchBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const canv = canvas
    const cx = ctx

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const colors = ['#ff4fd8', '#6df0ff', '#ffde59', '#ff477e', '#c724b1']

    function drawGlitch() {
      cx.clearRect(0, 0, canv.width, canv.height)

      const slices = 2 + Math.floor(Math.random() * 3)  // fewer: 2-4 instead of 3-6
      for (let i = 0; i < slices; i++) {
        const y = Math.random() * canv.height
        const h = 1 + Math.random() * 5                  // thinner: max 3px not 6px
        const w = 20 + Math.random() * 120               // shorter: max 120px not 240px
        const x = Math.random() * (canv.width - w)
        const color = colors[Math.floor(Math.random() * colors.length)]
        cx.globalAlpha = 0.08 + Math.random() * 0.15    // much more transparent
        cx.fillStyle = color
        cx.fillRect(x, y, w, h)
      }
      cx.globalAlpha = 1
    }

    // fire a burst then go quiet, repeat
    function burst() {
      let ticks = 0
      const max = 4 + Math.floor(Math.random() * 5)
      const interval = setInterval(() => {
        drawGlitch()
        ticks++
        if (ticks >= max) {
          clearInterval(interval)
          cx.clearRect(0, 0, canv.width, canv.height)
          // wait 2–6s before next burst
          setTimeout(burst, 2000 + Math.random() * 4000)
        }
      }, 60)
    }

    burst()

    return () => ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    />
  )
}

// app -----------

function App(): JSX.Element {
  const nextId = useRef(1)

  const makeHomeTab = (): Tab => ({
    id: 'home', label: 'home', type: 'home', mode: null,
    query: '', songs: [], descriptions: [], expandedQuery: '', 
    error: '', loading: false, summary: ''
  })

  const [tabs, setTabs] = useState<Tab[]>([makeHomeTab()])
  const [activeId, setActiveId] = useState<string>('home')
  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0]

  const [favoriteSongs, setFavoriteSongs] = useState<SongRecommendation[]>([])
  const toggleFavorite = (song: SongRecommendation) => {
    setFavoriteSongs(prev =>
      prev.find(s => s.id === song.id)
        ? prev.filter(s => s.id !== song.id)
        : [...prev, song]
    )
  }

  const [showPresets, setShowPresets] = useState(false)

  const presetQueries = [
    "soft sadness with warm memories",
    "late night overthinking energy",
    "like i'm healing but not there yet",
    "nostalgic but calm",
    "feeling like crying in the shower",
    "like the main character walking",
    "sad but make it danceable",
    "summer heartbreak",
    "3am can't sleep",
    "falling in love for the first time",
    "revenge glow up era",
    "like i'm missing someone but smiling anyway",
    "nostalgic for something i never had",
    "dancing alone in my room",
    "everything is fine but it's not",
  ]
  // rag summary minimized or not
  const [summaryMinimized, setSummaryMinimized] = useState(false)

  const summaryHeaderRef = useRef<HTMLDivElement>(null)
  const [frozenBg, setFrozenBg] = useState<string | null>(null)

  const toggleSummary = () => {
    if (!summaryMinimized && summaryHeaderRef.current) {
      const pos = getComputedStyle(summaryHeaderRef.current).backgroundPosition
      setFrozenBg(pos)
    } else {
      setFrozenBg(null)
    }
    playListSound();
    setSummaryMinimized(p => !p)
  }

  const cleanArtistName = (artist: string) => artist.replace(/[\[\]']/g, '')

  const loadingStatus = ['tuning in...', 'scanning vibes...', 'connecting...']
  const loadingSubs = ['hang tight bestie ♪', 'almost there ★', 'ur song is out there ♫']
  const [statusIdx, setStatusIdx] = useState(0)
  const [subIdx, setSubIdx] = useState(0)
  const [showHiw, setShowHiw] = useState(false)
  const hiwRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeTab.loading) return
    const a = setInterval(() => setStatusIdx(i => (i + 1) % loadingStatus.length), 8000)
    const b = setInterval(() => setSubIdx(i => (i + 1) % loadingSubs.length), 8000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [activeTab.loading])

  const addTab = () => {
    if (tabs.length >= 5) return
    const id = `tab-${nextId.current++}`
    setTabs(prev => [...prev, {
      id, label: 'new tab', type: 'setup', mode: null,
      query: '', songs: [], descriptions: [], expandedQuery: '',
      error: '', loading: false, summary: ''
    }])
    setActiveId(id)
  }

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeId === id) setActiveId(next[next.length - 1].id)
      return next
    })
  }

  const updateTab = (id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  const fetchByQuery = async (tabId: string, query: string, mode: SearchMode) => {
    updateTab(tabId, { loading: true, error: '', descriptions: [] })
    try {
      if (mode === 'rag') {
        const response = await fetch('/api/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 10 }),
        })
        if (!response.ok) {
          updateTab(tabId, { error: `Request failed (${response.status})`, songs: [] })
          return
        }
        const data = await response.json()
        const songs = data.songs ?? []

        // show songs immediately
        updateTab(tabId, {
          songs,
          expandedQuery: data.expanded_query ?? '',
          error: songs.length === 0 ? 'No matches found. Try different words.' : '',
          label: query.length > 14 ? query.slice(0, 14) + '…' : query,
        })
        // if (data.descriptions) updateTab(tabId, { descriptions: data.descriptions })

        // rag summary come in after
        if (data.summary) updateTab(tabId, { summary: data.summary})
      } else if (mode === 'svd') {
              // fire both requests simultaneously but handle them independently
        const songPromise = fetch(`/api/recommendations?query=${encodeURIComponent(query)}&top_k=10&mode=svd`)
        const descPromise = fetch('/api/rag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, top_k: 10, skip_expansion: true }),
        })

        // show songs as soon as they arrive
        const response = await songPromise
        if (!response.ok) {
          updateTab(tabId, { error: `Request failed (${response.status})`, songs: [] })
          return
        }
        const data: SongRecommendation[] = await response.json()
        updateTab(tabId, {
          songs: data,
          error: data.length === 0 ? 'No matches found. Try adding more emotional keywords.' : '',
          label: query.length > 14 ? query.slice(0, 14) + '…' : query,
        })

        // descriptions come in after — don't block songs coming on this
        descPromise.then(async r => {
          if (!r.ok) return
          const desc = await r.json()
          updateTab(tabId, { descriptions: desc.descriptions ?? [] })
        })
      } else {
        const response = await fetch(`/api/recommendations?query=${encodeURIComponent(query)}&top_k=10&mode=tfidf`)
        if (!response.ok) {
          updateTab(tabId, { error: `Request failed (${response.status})`, songs: [] })
          return
        }
        const data: SongRecommendation[] = await response.json()
        updateTab(tabId, {
          songs: data,
          error: data.length === 0 ? 'No matches found. Try adding more emotional keywords.' : '',
          label: query.length > 14 ? query.slice(0, 14) + '…' : query,
        })
      }
    } catch {
      updateTab(tabId, { error: 'Unable to load recommendations right now.', songs: [] })
    } finally {
      updateTab(tabId, { loading: false })
    }
  }

  const handleSearch = (e: FormEvent, tabId: string, query: string, mode: SearchMode | null) => {
    e.preventDefault()
    if (!query.trim()) { updateTab(tabId, { error: 'Please describe how you are feeling.' }); return }
    if (!mode) return
    fetchByQuery(tabId, query.trim(), mode)
  }

  return (
    <div className="full-body-container">
      <CursorTrail />
      <div className="retro-window">

        {/* Title bar */}
        <div className="retro-titlebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="retro-title">lyra.exe</span>
            <MuteButton />
          </div>
          <div className="retro-controls">
            <button className="retro-ctrl" onClick={playBoom}>_</button>
            <button className="retro-ctrl" onClick={playMiddle}>□</button>
            <button className="retro-ctrl retro-close" onClick={playError}>✕</button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="retro-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`retro-tab ${t.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(t.id)}
            >
              {t.label}
              {t.mode && t.type === 'search' && <span className="tab-chip">{t.mode}</span>}
              {t.id !== 'home' && (
                <span className="tab-close" onClick={e => closeTab(t.id, e)}>✕</span>
              )}
            </button>
          ))}
          {tabs.length < 5 && (
            <button className="tab-plus" onClick={addTab}>+</button>
          )}
        </div>

        {/* Body */}
        <div className="retro-body">

          {/* ── HOME ── */}
          {activeTab.type === 'home' && (
            <div className="home-view">
              <GlitchBackground />
              <header className="hero">
                <h1>Lyra</h1>
                <p>pour ur heart out ✦ we'll find ur song ♫</p>
              </header>
              <div className="home-btn-wrap">
                <button className="home-find-btn" onClick={() => { playClick(); addTab() }}>press start →</button>
                <button className="hiw-trigger-btn" onClick={() => {
                  playTransform()
                  setShowHiw(p => {
                    if (!p) setTimeout(() => hiwRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                    return !p
                  })
                }}>
                  ✦ how does it work? ✦
                </button>
                {showHiw && <HowItWorksModal ref={hiwRef} onClose={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  setTimeout(() => setShowHiw(false), 300)
                }} />}
              </div>
              {favoriteSongs.length > 0 && (
                <div className="favorites-wrap">
                  <div className="favorites-panel">
                    <div className="favorites-header">♥ favorites ♥</div>
                    {favoriteSongs.map(s => (
                      <div key={s.id} className="favorites-item">
                        <span className="fav-title">{s.title}</span>
                        <span className="fav-artist">{cleanArtistName(s.artist)}</span>
                        <button className="fav-remove" onClick={() => toggleFavorite(s)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* setup */}
          {activeTab.type === 'setup' && (
            <div className="mode-picker-wrap">
              <div className="mode-picker-card">
                <p className="mode-picker-heading">choose a search mode</p>
                <div className="mode-picker-opts">
                  {(['tfidf', 'svd', 'rag'] as SearchMode[]).map(m => (
                    <button
                      key={m}
                      className={`retro-btn ${activeTab.mode === m ? 'active' : ''}`}
                      onClick={() => { playSelect(); updateTab(activeTab.id, { mode: m }) }}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="mode-picker-note">
                  {activeTab.mode === 'rag' && 'RAG uses an LLM to understand metaphorical or long descriptions (e.g. "a rainy Sunday after a breakup").'}
                  {activeTab.mode === 'tfidf' && 'TF-IDF is fast keyword-matching; works best with concrete emotion words ("sad", "angry").'}
                  {activeTab.mode === 'svd' && 'SVD finds songs with similar emotional "shape" by matching against audio features (energy, valence, etc.) and lyrics.'}
                  {!activeTab.mode && 'Pick a mode to see how it works.'}
                </p>
                <button
                  className="mode-picker-start"
                  disabled={!activeTab.mode}
                  onClick={() => {
                    playConfirm()
                    updateTab(activeTab.id, { type: 'search', label: activeTab.mode! })
                  }}
                >
                  start searching →
                </button>
              </div>
            </div>
          )}

{/* ------ SEARCH ------- */}
          {activeTab.type === 'search' && (
            <div className="search-view-wrap">
              <div className="search-top-bar">

                {/* book button - sibling to search-bar, not inside it */}
                <div style={{ position: 'relative' }}>
                  <button className="book-btn" onClick={() => { playClick(); setShowPresets(p => !p) }}>
                    <img src={bookIcon} width={32} height={32} />
                  </button>
                  {showPresets && (
                    <div className="preset-panel">
                      <div className="preset-header">✦ mood starters book✦</div>
                      {presetQueries.map((q, i) => (
                        <button key={i} className="preset-item" onClick={() => {
                          updateTab(activeTab.id, { query: q })
                          setShowPresets(false)
                        }}>
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="search-bar">
                  <div className="input-with-prefix">
                    <span className="input-prefix">I feel...</span>
                    <div className="input-sizer">
                      <span className="input-sizer-text">{activeTab.query}</span>
                      <input
                        value={activeTab.query}
                        onChange={e => updateTab(activeTab.id, { query: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSearch(e, activeTab.id, activeTab.query, activeTab.mode)
                        }}
                        disabled={activeTab.loading}
                      />
                    </div>
                  </div>
                  <button
                    className="retro-btn"
                    onClick={e => { playClick(); handleSearch(e, activeTab.id, activeTab.query, activeTab.mode) }}
                    disabled={activeTab.loading}
                  >
                    find my song
                  </button>
                </div>

              </div>

              {activeTab.loading && (
                <div className="loading-screen">
                  <div className="loading-status">{loadingStatus[statusIdx]}</div>
                  <div className="loading-stars">
                    <span>★</span><span>✦</span><span>★</span><span>✦</span><span>★</span>
                  </div>
                  <div className="loading-bar-wrap">
                    <div className="loading-bar-label">LOADING</div>
                    <div className="loading-bar-outer">
                      <div className="loading-bar-inner" />
                    </div>
                  </div>
                  <div className="loading-subtitle">{loadingSubs[subIdx]}</div>
                </div>
              )}
              {activeTab.error && <div className="error-banner">{activeTab.error}</div>}
              {activeTab.mode === 'rag' && activeTab.songs.length > 0 && (
                <div className="rag-summary">
                  <div
                    ref={summaryHeaderRef}
                    className="rag-summary-header"
                    style={{
                      animation: summaryMinimized ? 'none' : undefined,
                      backgroundPosition: frozenBg && summaryMinimized ? frozenBg : undefined,
                    }}
                    onClick={toggleSummary}
                  >
                    ✦ why these songs? ✦
                    <span style={{ float: 'right', fontSize: '14px' }}>{summaryMinimized ? '▼' : '▲'}</span>
                  </div>
                  {!summaryMinimized && (
                    <div className="rag-summary-body">
                      {activeTab.summary ? activeTab.summary : (
                        <div className="song-summary-ghost">
                          <div className="song-summary-ghost-line" style={{ width: '92%' }} />
                          <div className="song-summary-ghost-line" style={{ width: '85%' }} />
                          <div className="song-summary-ghost-line" style={{ width: '88%' }} />
                          <div className="song-summary-ghost-line" style={{ width: '60%' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab.songs.length > 0 && (
                <WinampPlayer
                  songs={activeTab.songs}
                  descriptions={activeTab.descriptions}
                  expandedQuery={activeTab.expandedQuery}
                  query={activeTab.query}
                  onClickSound={playClick}
                  mode={activeTab.mode!}
                  favoriteSongs={favoriteSongs}
                  onToggleFavorite={toggleFavorite}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default App