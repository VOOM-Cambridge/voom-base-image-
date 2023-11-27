import React from 'react'
import { Container, Form, Card, Col, Row, Button, Modal, Table, Spinner, InputGroup, DropdownButton, Dropdown } from 'react-bootstrap'
import { useParams } from 'react-router-dom'
import { useMQTTSend } from './MQTTContext';
import APIBackend from './RestAPI'
import * as dayjs from 'dayjs'
import { useToastDispatch, add_toast } from "./ToastContext";

//todo reasons modification page (download new config file - save in right place)
//todo cancel

const STATUS = { pass: "pass", rework: "rework", scrap: "scrap" }

function groupBy(xs, key) {
  return xs.reduce(function (rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};


export function BatchPage({ config, operation_list }) {
  const inputRef = React.useRef(null);

  let params = useParams();
  const operation_id = Number(params.operation_id)
  let operation = operation_list.find(elem => elem.id === operation_id)
  const [part, setPart] = React.useState("")

  const sendJsonMessage = useMQTTSend()

  let [loaded, setLoaded] = React.useState(false)
  let [pending, setPending] = React.useState(false)
  let [error, setError] = React.useState(null)
  let [showModal, setShowModal] = React.useState(false);
  let [modalType, setModalType] = React.useState(STATUS.pass)
  let [state, doSetState] = React.useState(
    {
      pass: 0,
      rework: [],
      scrap: []
    })
  let [reasons, setReasons] = React.useState([])

  let toast_dispatch = useToastDispatch()

  React.useEffect(() => {
    let do_load = async () => {
      setPending(true)
      let url = (config.reasons_api.host ? config.reasons_api.host : window.location.hostname) + (config.reasons_api.port ? ":" + config.reasons_api.port : "")
      let response = await APIBackend.api_get('http://' + url + '/reasons/' + operation_id);
      if (response.status === 200) {
        let raw_reasons = response.payload;
        let reasons = groupBy(raw_reasons, "type_tag")
        console.log("Loaded Reasons:", raw_reasons, reasons)
        setReasons(reasons)
      } else {
        console.error("Unable to load reasons for operation " + operation_id + " using default list")
        setError("Unable to load error reasons for this operation - please try refresh")
      }
      setLoaded(true)
    }
    if (!loaded && !pending) {
      do_load()
    }
  }, [loaded, pending, config, operation_id])

  const setState = (type, id, value) => {
    let int_value = Number(value)
    if (value === "")
      int_value = 0

    if (type === STATUS.pass) {
      doSetState((prev) => ({ ...prev, pass: int_value }));
    } else {
      doSetState((prev) => {
        let index = prev[type].findIndex(item => item.id === id)
        if (index === -1)
          return { ...prev, [type]: [...prev[type], { id: id, value: int_value }] }
        else {
          let new_array = prev[type]
          new_array[index].value = int_value;
          return { ...prev, [type]: new_array }
        }
      });
    }
  }

  //todo: only add to event list if sent
  const handle_submit_event = async () => {
    if (!part) {
      add_toast(toast_dispatch, { header: "Error", body: "Please Select Part" })
      return
    }

    let base_message = { part: part, operation: operation.name,timestamp: dayjs().format() }
    let results = []
    results.push({outcome:"pass",detail:[{reason:"pass",count: state.pass}]})
    
    for( let type of ["rework","scrap"]){
      let entry = {outcome:type,detail:[]}
      for (let state_entry of state[type]){
        let reason = reasons[type].find(elem=>elem.id===state_entry.id)
        entry.detail.push({reason:reason.text,count:state_entry.value})
      }
      results.push(entry)
    }

    console.log(results)

    let topic = ["batch"]

    topic.unshift(operation.name ? operation.name : "unspecified");

    let payload = { ...base_message, results }

    try {
      sendJsonMessage(topic, payload);
      add_toast(toast_dispatch, { header: "Sent", body: "" })
    }
    catch (err) {
      console.error(err)
      add_toast(toast_dispatch, { header: "Error", body: err })
    }
    finally {
      if (config?.capture_page?.clear_part_on_submit) {
        setPart("")
        inputRef.current.focus();
      }
      doSetState({
        pass: 0,
        rework: [],
        scrap: []
      })
    }
  }

  const handleButtonClick = (value) => {
    setShowModal(true)
    setModalType(value)
    // inputRef.current.focus(); //set focus to text input so that modal returns focus to that once closed
  }

  const submitData = (id) => {
    handle_submit_event()
  }

  if (!loaded) {
    return <Container fluid="md">
      <Card className='mt-2 text-center'>
        {error !== null ? <h1>{error}</h1> : <Spinner></Spinner>}
      </Card>
    </Container>
  } else {
    return <>
      <Card className='mt-2'>
        <Card.Header className='text-center'>
          <h1>{operation?.name}</h1>
        </Card.Header>
        <Card.Body>
          <PartBar
            part={part}
            setPart={setPart}
            config={config}
            inputRef={inputRef}
          />
          <ButtonBar handleButtonClick={handleButtonClick} />
          <PayloadSummary
            state={state}
            reasons={reasons}
          />
          <Button size="lg" onClick={submitData}>Submit</Button>
          {/* <EventLog events={eventList} config={config} /> */}
        </Card.Body>
      </Card>
      <ModalManager
        show={showModal}
        type={modalType}
        reasons={reasons}
        handleClose={() => {setShowModal(false);}}
        fullscreen={config?.capture_page?.fullscreen_modal}
        state={state}
        setState={setState}
      />
    </>
  }
}

function PartBar({ part, setPart, config, inputRef }) {
  let inputs = ""
  if (config?.capture_page?.part_entry === "text") {
    inputs = <>
      <InputGroup.Text>Part:</InputGroup.Text>
      <Form.Control autoFocus ref={inputRef} placeholder='Part / Product ID' value={part} onChange={(event) => setPart(event.target.value)} />
    </>
  } else {
    let options = config?.capture_page?.part_entry_options ?? []
    inputs = <>
      <DropdownButton
        align="end"
        variant="secondary"
        title={"Part "}
        className="d-grid gap-2"
      >
        {options.map(item => (
          <Dropdown.Item onClick={() => setPart(item)} key={item}>{item}</Dropdown.Item>
        ))}
      </DropdownButton>
      <Form.Control readOnly={true} value={part} />
    </>
  }

  return <Container fluid>
    <InputGroup className="mb-3 w-100">
      {inputs}
    </InputGroup>
  </Container>
}

function ButtonBar({ handleButtonClick }) {
  return <Container fluid>
    <Row className='gx-2 gy-1'>
      <Col xs={12} sm={4} className="d-grid px-1">
        <Button variant="success" size="lg" onClick={() => handleButtonClick(STATUS.pass)}>Add Good</Button>
      </Col>
      <Col xs={12} sm={4} className="d-grid px-1">
        <Button variant="warning" size="lg" onClick={() => handleButtonClick(STATUS.rework)}>Add Rework</Button>
      </Col>
      <Col xs={12} sm={4} className="d-grid px-1">
        <Button variant="danger" size="lg" onClick={() => handleButtonClick(STATUS.scrap)}>Add Scrap</Button>
      </Col>
    </Row>
  </Container>
}

function ModalManager(props) {

  if (props.type === STATUS.pass) {
    return <PassModal {...props} />
  }
  if (props.type === STATUS.rework || props.type === STATUS.scrap) {
    return <ReasonModal {...props} />
  }
}

function PassModal({ show, state, setState, handleClose, fullscreen }) {
  const inputRef = React.useRef(null);

  let onSubmit = (e) => {
    e.preventDefault();
    handleClose()
  }

  return <Modal show={show} size="lg" fullscreen={fullscreen} onHide={handleClose} onEntered={() => {inputRef.current.focus()}}>
    <Modal.Header closeButton>
      <Modal.Title>Set Number of Good Parts</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Form onSubmit={onSubmit}>
        <Form.Group controlId="formFile" className="mb-3">
          <Form.Label>Count:</Form.Label>
          <Form.Control type="text" ref={inputRef} value={state.pass} onChange={(event) => (setState(STATUS.pass, undefined, event.target.value.replace(/\D/, '')))} isInvalid={false} />
          <Form.Control.Feedback type="invalid">
            Please choose a valid value
          </Form.Control.Feedback>
        </Form.Group>
      </Form>
    </Modal.Body>
  </Modal>
}

function ReasonModal({ show, type, state, setState, handleClose, fullscreen, reasons }) {
  const inputRef = React.useRef(null);
  let onSubmit = (e) => {
    e.preventDefault();
    handleClose()
  }
  let handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleClose()
    }
  }
  return <Modal show={show} size="lg" fullscreen={fullscreen} onHide={handleClose} onEntered={() => {inputRef.current.focus()}}>
    <Modal.Header closeButton>
      <Modal.Title>Set Number of Reworked Parts</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Form onSubmit={onSubmit}>
        <Table>
          <thead>
            <tr>
              <th style={{ width: "70%" }}>Reason</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {reasons[type].map((reason_item, index) => {
              let state_value = state[type].find(elem => elem.id === reason_item.id)?.value ?? 0
              return <tr key={index}>
                <td>
                  {reason_item.text}
                </td>
                <td>
                  <Form.Control onKeyPress={handleKeyPress} ref={index===0?inputRef:null} type="text" value={state_value} onChange={(event) => (setState(type, reason_item.id, event.target.value.replace(/\D/, '')))} isInvalid={false} />
                  <Form.Control.Feedback type="invalid">
                    Please choose a valid value
                  </Form.Control.Feedback>
                </td>
              </tr>
            })}
          </tbody>
        </Table>
      </Form>
    </Modal.Body>
  </Modal>
}

function PayloadSummary({ state, reasons }) {
  return <Card className='my-1'>
    <Table className='m-0'>
      <tbody>
        <tr>
          <th className='table-secondary'>Good:</th>
          <th className='table-secondary'>{state.pass}</th>
        </tr>
        <tr>
          <th className='table-secondary'>Rework:</th>
          <th className='table-secondary'>{state.rework.reduce((acc, item) => (acc += item.value), 0)}</th>
        </tr>
        {state.rework.map((item, index) => {
          if (item.value > 0) {
            return <tr key={index}>
              <td>
                {reasons.rework.find(elem => elem.id === item.id).text}
              </td>
              <td>
                {item.value}
              </td>
            </tr>
          }
          return ""
        })}
        <tr>
          <th className='table-secondary'>Scrap:</th>
          <th className='table-secondary'>{state.scrap.reduce((acc, item) => (acc += item.value), 0)}</th>
        </tr>
        {state.scrap.map((item, index) => {
          if (item.value > 0) {
            return <tr key={index}>
              <td>
                {reasons.scrap.find(elem => elem.id === item.id).text}
              </td>
              <td>
                {item.value}
              </td>
            </tr>
          }
          return ""
        })}
      </tbody>
    </Table>
  </Card>
}

