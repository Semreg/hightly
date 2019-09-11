import React, { useState, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet'
import Animated from '../other/Animated'
import EmptyEmbed from '../layouts/EmptyEmbed'
import Layout from '../layouts/Layout'
import { useAlert } from 'react-alert'
import uuid from 'uuid/v1'
import config from '../../config'
import './stream-form.scss'

// Custom hooks
import useSocketConnection from '../../hooks/useSocketConnection'
import usePeer from '../../hooks/usePeer'

const isProd = process.env.NODE_ENV === 'production'

function StreamForm (props) {
  const [viewersList, setViewersList] = useState({})

  const [id, setId] = useState(uuid())
  const [stream, setStream] = useState(null)

  const videoRef = useRef(null)

  const [socket, isConnected] = useSocketConnection(config.SIGNALING_SERVER_URL, 'streamer', { peerId: id })

  const peer = usePeer(id, {
    host: config.PEER_SERVER_HOST,
    port: config.PEER_SERVER_PORT,
    path: '/peer'
  })

  const alert = useAlert()

  // Set stream id
  useEffect(() => {
    if (peer) {
      setId(peer.id)
    }
  }, [peer])

  // Notify user about connection status updates
  useEffect(() => {
    if (isConnected === false) {
      alert.error('Disconnected from server')
    } else if (isConnected === true) {
      alert.success('Connected to server')
    } else {
      alert.info('Attempting to connect to server...')
    }
  }, [isConnected])

  useEffect(() => {
    if (socket && viewersList && peer) {
      socket.emit('createStream', { streamId: peer.id })

      socket.emit('setProps', {
        peerId: peer.id
      })

      socket.on('addNewViewer', viewerId => {
        console.log(`✅ new viewer <${viewerId}> connected`)

        const newViewersList = viewersList

        if (stream) {
          const call = peer.call(viewerId, stream)

          if (call) {
            newViewersList[viewerId] = { active: true }
            setViewersList(newViewersList)
          } else {
            newViewersList[viewerId] = { active: false }
            setViewersList(newViewersList)
          }
        } else {
          newViewersList[viewerId] = { active: false }
          setViewersList(newViewersList)
        }
      })

      socket.on('removeViewer', viewerId => {
        console.log(`❌ viewer <${viewerId}> disconnected`)

        const newViewersList = viewersList

        delete newViewersList[viewerId]

        setViewersList(newViewersList)
      })
    }
  }, [socket, viewersList, peer, stream])

  // Display captured video
  useEffect(() => {
    if (stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    if (stream && peer && viewersList) {
      for (const id in viewersList) {
        if (!viewersList[id].active) {
          peer.call(id, stream)

          const newViewersList = viewersList

          newViewersList[id] = { active: true }

          setViewersList(newViewersList)
        }
      }
    }
  }, [stream, peer, viewersList])

  async function startCapture () {
    let displayMediaOptions = {
      cursor: 'always',
      video: {
        width: {
          ideal: 1920,
          max: 1920
        },
        height: { ideal: 1080 }
      }
    }

    const supports = navigator.mediaDevices.getSupportedConstraints()

    if (supports['frameRate'] && supports['aspectRatio']) {
      displayMediaOptions = {
        ...displayMediaOptions,
        video: {
          ...displayMediaOptions.video,
          frameRate: { max: 60 },
          aspectRatio: 1.7777777778
        }
      }
    }

    try {
      const capturedStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)

      setStream(capturedStream)
    } catch (err) {
      console.error(err)
    }
  }

  function stopCapture () {
    if (videoRef.current.srcObject && viewersList) {
      videoRef.current.srcObject
        .getTracks()
        .forEach(track => track.stop())

      setStream(null)
      videoRef.current.srcObject = null

      for (const id in viewersList) {
        const newViewersList = viewersList

        newViewersList[id] = { active: false }

        setViewersList(newViewersList)
      }
    }
  }

  const onInputClick = e => {
    e.target.select()
    document.execCommand('copy')
    alert.success('Coppied co clipboard')
  }

  return (
    <Layout>
      <Animated>
        <Helmet>
          <title>{`${stream ? '🔴' : ''}`} Hightly &#183; Stream</title>
        </Helmet>
        <div className='jumbotron text-center pt-1'>
          <hr/>
          <div className='status-badges'>
            <div className='text-muted mt-1'>
            Stream status:&nbsp;&nbsp;
              {stream
                ? <span className='badge badge-danger'>Live</span>
                : <span className='badge badge-warning'>Inactive</span>
              }
            </div>
            <div className='text-muted mt-1'>
            Server connection status:&nbsp;&nbsp;
              {isConnected
                ? <span className='badge badge-success'>Online</span>
                : <span className='badge badge-warning'>Offline</span>
              }
            </div>
          </div>
          <hr className='my-4' />
          <div className='embed-responsive embed-responsive-16by9'>
            {stream
              ? <video ref={videoRef} className='embed-responsive-item' autoPlay />
              : <EmptyEmbed />
            }
          </div>
          <hr className='my-4' />
          <div className='pt-2'>
            <button onClick={startCapture} type='button' className={`btn btn-outline-success waves-effect btn-round ${stream === null ? '' : 'disabled'}`}>Start <span className='fas fa-play ml-1'></span></button>
            <button onClick={stopCapture} type='button' className={`btn btn-outline-danger waves-effect btn-round ${stream !== null ? '' : 'disabled'}`}>Stop <i className='fas fa-stop'></i></button>
          </div>
          <h2 className='card-title h2 mt-4'>Share Your Link</h2>
          <div className='row d-flex justify-content-center'>
            <div className='col-xl-7 pb-2'>
              <p className='card-text'>Share this link so others can see your demonstration</p>
            </div>
          </div>
          <div className='align-center'>
            <div className='md-form' style={{ 'textAlign': 'left', 'color': '#777' }}>
              <i className='fas fa-link prefix'></i>
              <input onClick={onInputClick} autoFocus readOnly type='text' id='inputIconEx2' className='form-control' value={`${id ? `${isProd ? config.URL : 'http://localhost:3000'}/watch/${id}` : ''}`}/>
              <label htmlFor='inputIconEx2'>Link to your stream</label>
            </div>
          </div>
        </div>
      </Animated>
    </Layout>
  )
}

export default StreamForm
