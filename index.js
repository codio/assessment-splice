(function (){
  let assessmentOptions = null
  let assessment = null
  let processing = false
  let currentData = null

  const SPLICE_METHODS = {
    REPORT_SCORE_AND_STATE: 'SPLICE.reportScoreAndState',
    GET_STATE: 'SPLICE.getState',
    GET_STATE_RESPONSE: 'SPLICE.getState.response',
    FRAME_RESIZE: 'lti.frameResize',
  }

  const updateProcessing = (status) => {
    processing = status
  }

  const applyStateInitial = (data) => {
    const {state, result, ...dataWithoutState} = data
    assessment = dataWithoutState.assessment
    assessmentOptions = dataWithoutState.options

    render()
  }

  const applyState = (data) => {
    console.log('assessment iframe applyState', data)
    currentData = data
    if (!assessment) {
      applyStateInitial(data)
    }
    // todo sent set state to iframe??
  }

  const renderContent = () => {
    $('.instructions-text').html(assessment.source.settings.instructions)
    const iframe = $(`<iframe class="codio-assessment-splice-iframe" />`)
    iframe.attr('title', `Assessment - ${assessment.source.name}`)
    iframe.attr('src', assessment.source.settings.url)
    $('.codio-assessment-iframe-wrapper').append(iframe)
  }

  const bindEvents = () => {
    window.codioAssessmentsHelper.addBodyHeightListener()
  }

  const render = () => {
    const container = $('.codio-assessment')
    const nameEl = container.find('.codio-assessment-name')
    assessment.source.showName ? nameEl.text(assessment.source.name) : nameEl.remove()
    renderContent()
    bindEvents()
    container.removeClass('hide')
  }

  const sendToIframe = (method, message) => {
    const iframe = $('.codio-assessment-splice-iframe')
    iframe.contentWindow.postMessage({subject: method, ...message}, '*')
  }

  const getStateObj = () => {
    const {result} = currentData || {}
    if (!result?.stateJson) {
      return null
    }

    try {
      return JSON.parse(result.stateJson)
    } catch {
      return null
    }
  }

  const sendStateToIframe = (messageId) => {
    if (!messageId) {
      return
    }

    sendToIframe(
      SPLICE_METHODS.GET_STATE_RESPONSE, {
        message_id: messageId,
        state: getStateObj()
      }
    )
  }

  const reportScoreAndState = ({score, state}) => {
    if (processing) {
      return
    }
    updateProcessing(true)
    window.codioAssessmentsHelper.send(
      window.codioAssessmentsHelper.METHODS.SUBMIT_ANSWER,
      {result: {score, state}}
    )
  }

  const resizeIframe = ({width, height}) => {
    const iframe = $('.codio-assessment-splice-iframe')
    iframe.width(width || '100%').height(height || 'auto')
  }

  const sendGetFileContent = async (data) => {
    const messageId = data.message_id || window.codioAssessmentsHelper.GUID()
    try {
      const result = await window.codioAssessmentsHelper.sendAndWait(
        window.codioAssessmentsHelper.METHODS.GET_FILE_CONTENT, data
      )
      sendToIframe(
        window.codioAssessmentsHelper.METHODS.CODIO_GET_FILE_CONTENT_RESPONSE,
        {message_id: messageId, content: result.content}
      )
    } catch (err) {
      sendToIframe(
        window.codioAssessmentsHelper.METHODS.CODIO_GET_FILE_CONTENT_RESPONSE,
        {message_id: messageId, error: err.message}
      )
    }
  }

  const sendSetFileContent = async (data) => {
    const messageId = data.message_id || window.codioAssessmentsHelper.GUID()
    try {
      await window.codioAssessmentsHelper.sendAndWait(
        window.codioAssessmentsHelper.METHODS.SET_FILE_CONTENT, data
      )
      sendToIframe(
        window.codioAssessmentsHelper.METHODS.CODIO_SET_FILE_CONTENT_RESPONSE,
        {message_id: messageId}
      )
    } catch (err) {
      sendToIframe(
        window.codioAssessmentsHelper.METHODS.CODIO_SET_FILE_CONTENT_RESPONSE,
        {message_id: messageId, error: err.message}
      )
    }
  }

  const processMessage = (jsonData) => {
    try {
      const {method, data} = JSON.parse(jsonData)
      console.log('assessment iframe processMessage', jsonData, method, data)
      switch (method) {
        case window.codioAssessmentsHelper.METHODS.GET_STYLES_RESPONSE:
          window.codioAssessmentsHelper.addStyle(data.css)
          break
        case window.codioAssessmentsHelper.METHODS.GET_STATE_RESPONSE:
          updateProcessing(false)
          applyState(data)
          break
        case window.codioAssessmentsHelper.METHODS.CALLBACK: {
          window.codioAssessmentsHelper.processCallback(data)
          break
        }
        case SPLICE_METHODS.GET_STATE:
          sendStateToIframe(data.message_id)
          break
        case SPLICE_METHODS.REPORT_SCORE_AND_STATE:
          reportScoreAndState(data)
          break
        case SPLICE_METHODS.FRAME_RESIZE:
          resizeIframe(data)
          break
        case window.codioAssessmentsHelper.METHODS.CODIO_GET_FILE_CONTENT:
          sendGetFileContent(data)
          break
        case window.codioAssessmentsHelper.METHODS.CODIO_SET_FILE_CONTENT:
          sendSetFileContent(data)
          break
      }
    } catch {}
  }

  window.addEventListener('load', () => {
    window.codioAssessmentsHelper.registerMessageListener(processMessage)
    window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.GET_STATE)
    window.codioAssessmentsHelper.send(window.codioAssessmentsHelper.METHODS.GET_STYLES)
  })
})()
