import React from 'react'
import { Container, Pagination, Card, Col, Row, Button, Modal, Table, Spinner, InputGroup, Form, DropdownButton, Dropdown } from 'react-bootstrap'
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

export function CapturePage({ config, operation_list}) {
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
  let [eventList, setEventList] = React.useState([])
  let [reasons, setReasons] = React.useState([])

  let toast_dispatch = useToastDispatch()

  React.useEffect(() => {
    let do_load = async () => {
      setPending(true)
      let url = (config.reasons_api.host ? config.reasons_api.host : window.location.hostname) + (config.reasons_api.port ? ":" + config.reasons_api.port : "")
      let response = await APIBackend.api_get('http://' + url + '/reasons/' + operation_id);
       if (response.status === 200) {
        let raw_reasons = response.payload;
        let reasons = groupBy(raw_reasons,"type_tag")
        console.log("Loaded Reasons:",raw_reasons,reasons)
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

  //todo: only add to event list if sent
  const handle_event = async (event_type, reason) => {
    if (!part) {
      add_toast(toast_dispatch, { header: "Error", body: "Please Select Part" })
      return
    }

    if(event_type===STATUS.pass){
      reason="pass";
    }

    let base_message = { part: part, operation: operation.name, outcome:event_type, count: 1}
    
    base_message = { ...base_message, reason: reason }
    let timestamp = dayjs()

    let topic = event_type
    if (!Array.isArray(topic))
      topic = [topic]

    topic.unshift("single");

    topic.unshift(operation.name ? operation.name : "unspecified");

    let payload = { ...base_message, timestamp: timestamp.format() }

    try {
      sendJsonMessage(topic, payload);
      setEventList(prev => [{ ...base_message, timestamp: timestamp }, ...prev])
      add_toast(toast_dispatch, { header: "Sent"})
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
    }
  }

  const handleButtonClick = (value) => {
    setShowModal(value !== STATUS.pass)
    setModalType(value)

    if (value === STATUS.pass) {
      handle_event(value)
    } else {
      inputRef.current.focus(); //set focus to text input so that modal returns focus to that once closed
    }
  }

  const handleReasonClick = (id) => {
    let reason = reasons[modalType].find(elem => elem.id === id).text
    setShowModal(false)
    handle_event(modalType, reason)
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
          <EventLog events={eventList} config={config} />
        </Card.Body>
      </Card>
      <ReasonModal
        show={showModal}
        type={modalType}
        handleClick={handleReasonClick}
        reasons={reasons}
        handleClose={() => setShowModal(false)}
        fullscreen={config?.capture_page?.fullscreen_modal}
      />
    </>
  }
}

function PartBar({ part, setPart, config, inputRef }) {
  let inputs = ""
  if (config?.capture_page?.part_entry === "text") {
    inputs = <>
      <InputGroup.Text>Part:</InputGroup.Text>
      <Form.Control ref={inputRef} placeholder='Part / Product ID' value={part} onChange={(event) => setPart(event.target.value)} />
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
        <Button variant="success" size="lg" onClick={() => handleButtonClick(STATUS.pass)}>Pass</Button>
      </Col>
      <Col xs={12} sm={4} className="d-grid px-1">
        <Button variant="warning" size="lg" onClick={() => handleButtonClick(STATUS.rework)}>Rework</Button>
      </Col>
      <Col xs={12} sm={4} className="d-grid px-1">
        <Button variant="danger" size="lg" onClick={() => handleButtonClick(STATUS.scrap)}>Scrap</Button>
      </Col>
    </Row>
  </Container>
}

function ReasonModal({ show, type, handleClick, reasons, handleClose, fullscreen }) {
  const title_prefix = { [STATUS.rework]: "Rework", [STATUS.scrap]: "Scrap" }
  return <Modal show={show} size="lg" fullscreen={fullscreen} onHide={handleClose}>
    <Modal.Header closeButton>
      <Modal.Title>{title_prefix[type]} Reason</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <Row className='gx-2 gy-2'>
        {reasons[type]?.map(reason => (
          <Col xs={12} sm={6} md={4} lg={3} key={reason.id} className='d-grid'>
            <Button variant="primary" onClick={() => handleClick(reason.id)}>
              {reason.text}
            </Button>
          </Col>
        ))}
      </Row>
    </Modal.Body>
  </Modal>
}

function EventLog({ events, config }) {
  const [active_page, setActive] = React.useState(1)
  let page_size = config?.capture_page?.event_log_length ?? 10
  page_size = Number(page_size)
  let n_pages = Math.ceil(events.length / page_size)
  n_pages = n_pages > 0 ? n_pages : 1
  let current_page_set = paginate(events, page_size, active_page)

  return <Card className='mt-4 mx-2'>
    <PaginateWidget active={active_page} n_pages={n_pages} setPage={(number) => setActive(number)} />
    <Table bordered striped responsive="sm">
      <thead>
        <tr>
          <th>Part</th>
          <th>Result</th>
          <th>Reason</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {current_page_set.map((event, index) => (
          // <OverlayTrigger
          //   trigger="click"
          //   key={index}
          //   placement={"bottom"}
          //   rootClose
          //   overlay={
          //     <Popover>
          //       <Popover.Body>
          //         <Button variant="danger">Cancel</Button>
          //       </Popover.Body>
          //     </Popover>
          //   }
          // >
            <tr key={index}>
              <td>{event.part !== "" ? event.part : event.part_type}</td>
              <td>{event.outcome}</td>
              <td>{event?.reason}</td>
              <td>{event.timestamp.format('DD/MM/YYYY HH:mm:ss')}</td>
            </tr>
          // </OverlayTrigger>
        ))}
      </tbody>
    </Table>
  </Card>
}

function PaginateWidget({ active, n_pages, setPage }) {
  const [scroll, doSetScroll] = React.useState(1)
  const show_limit = 8

  //defaults: n_pages <= show_limit - show all normally
  let pages_shown = n_pages
  let show_prev = false
  let prev_active = false
  let prev_ellipsis = false
  let next_ellipsis = false
  let next_active = false
  let show_next = false

  if (n_pages > show_limit) {
    pages_shown = show_limit - 4
    show_prev = true
    prev_ellipsis = true
    next_ellipsis = true
    show_next = true

    if (scroll < 3) {
      show_prev = false
      pages_shown++
      prev_ellipsis = false
      pages_shown++
    }

    if (scroll > active) {
      prev_active = true
      pages_shown--
    }

    if (scroll > n_pages - pages_shown - 2) {
      show_next = false
      pages_shown++
      next_ellipsis = false
      pages_shown++
    } else if (scroll + pages_shown <= active) {
      next_active = true
      pages_shown--

      // if(scroll + pages_shown === active -1)
      // {
      //   next_ellipsis = false
      //   pages_shown++
      // }
    }
  }


  const setScroll = (n) => {
    if (n === +1 && scroll < 4) {
      doSetScroll(5)
      return
    }
    if (n === -1 && scroll === 5) {
      doSetScroll(1)
      return
    }

    if (n === +1 && active === scroll) {
      n = +2
    }

    if (n === +1 && scroll + pages_shown === active - 1) {
      n = +1
    }

    if (n === -1 && active === scroll - 2) {
      n = -2
    }
    // if (n >= 1 && n <= n_pages - show_limit + 1)
    doSetScroll(scroll + n)
  }

  let pages = Array.from({ length: pages_shown }, (_, i) => i + scroll)

  return <div className="d-flex justify-content-center mt-1 mb-1">
    <Pagination size="sm" className='mb-0'>
      {show_prev ? <Pagination.Prev onClick={() => setScroll(-1)} /> : ""}
      {prev_active ? <Pagination.Item key={active} active={true}>{active}</Pagination.Item> : ""}
      {prev_ellipsis ? <Pagination.Ellipsis /> : ""}
      {pages.map(number => (<Pagination.Item key={number} active={number === active} onClick={() => setPage(number)}>{number}</Pagination.Item>))}
      {next_ellipsis ? <Pagination.Ellipsis /> : ""}
      {next_active ? <Pagination.Item key={active} active={true}>{active}</Pagination.Item> : ""}
      {show_next ? <Pagination.Next onClick={() => setScroll(+1)} /> : ""}
    </Pagination>
  </div>
}

function paginate(array, page_size, page_number) {
  // human-readable page numbers usually start with 1, so we reduce 1 in the first argument
  return array.slice((page_number - 1) * page_size, page_number * page_size);
}
