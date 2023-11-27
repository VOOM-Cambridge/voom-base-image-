import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route, NavLink, Outlet } from 'react-router-dom'
import { Container, Navbar, Nav, Row, Col, ToastContainer, Toast, Card, Spinner, ListGroup, Button } from 'react-bootstrap';
import { CapturePage } from './CapturePage';
import { BatchPage } from './BatchPage';
import { MQTTProvider, useMQTTState } from './MQTTContext'
import { ToastProvider } from './ToastContext'
import React from 'react';
import APIBackend from './RestAPI'

function App() {
  let [loaded, setLoaded] = React.useState(false)
  let [pending, setPending] = React.useState(false)
  let [error, setError] = React.useState(null)
  let [config, setConfig] = React.useState([])


  React.useEffect(() => {
    let do_load = async () => {
      setPending(true)
      let response = await APIBackend.api_get('http://' + document.location.host + '/config/config.json');
      if (response.status === 200) {
        const raw_conf = response.payload;
        console.log("config", raw_conf)
        setConfig(raw_conf)
        setLoaded(true)
      } else {
        console.log("ERROR LOADING CONFIG")
        setError("ERROR: Unable to load configuration!")
      }
    }
    if (!loaded && !pending) {
      do_load()
    }
  }, [loaded, pending])
  if (!loaded) {
    return <Container fluid="md">
      <Card className='mt-2 text-center'>
        {error !== null ? <h1>{error}</h1> : <div><Spinner></Spinner> <h2 className='d-inline'>Loading Config</h2></div>}
      </Card>
    </Container>
  } else {
    return (
      <MQTTProvider
        host={config?.mqtt?.host ?? document.location.hostname}
        port={config?.mqtt?.port ?? 9001}
        prefix={config?.mqtt?.prefix ?? []}>
        <ToastProvider position='bottom-center'>
          <BrowserRouter>
            <Routing config={config} />
          </BrowserRouter>
        </ToastProvider>
      </MQTTProvider>
    )
  }
}

function Routing(props) {
  let [operation_list, setOperationList] = React.useState([])

  return (
    <Routes>
      <Route path='/' element={<Base operation_list={operation_list} setOperationList={setOperationList} {...props} />}>
        <Route path='/operations' element={<OperationList operation_list={operation_list} config={props.config} />} />
        <Route path='/single/:operation_id' element={<CapturePage operation_list={operation_list} {...props} />} />
        <Route path='/batch/:operation_id' element={<BatchPage operation_list={operation_list} {...props} />} />
        <Route index element={<OperationList operation_list={operation_list} setOperationList={setOperationList} config={props.config} />}></Route>
      </Route>
    </Routes>
  )
}

function Base({ setOperationList, config }) {
  let { connected } = useMQTTState()
  let variant = "danger"
  let text = "Disconnected"
  if (connected) {
    variant = "success"
    text = "Connected"
  }

  let [loaded, setLoaded] = React.useState(false)
  let [pending, setPending] = React.useState(false)
  let [error, setError] = React.useState(null)

  React.useEffect(() => {
    let do_load = async () => {
      setPending(true)
      let url = (config.reasons_api.host ? config.reasons_api.host : window.location.hostname) + (config.reasons_api.port ? ":" + config.reasons_api.port : "")
      let response = await APIBackend.api_get('http://' + url + '/operations/');
      if (response.status === 200) {
        setOperationList(response.payload)
        setLoaded(true)
      } else {
        console.error("Unable to load list of operations")
        setError("Unable to load list of operations - please try refresh")
      }
    }
    if (!loaded && !pending) {
      do_load()
    }
  }, [loaded, pending, config, setOperationList])

  if (!loaded) {
    return <Container fluid="md">
      <Card className='mt-2 text-center'>
        {error !== null ? <h1>{error}</h1> : <div><Spinner></Spinner> <h2 className='d-inline'>Loading Operations</h2></div>}
      </Card>
    </Container>
  } else {
    return (
      <Container fluid className="vh-100 p-0 d-flex flex-column">
        {/* <div id='header'> */}
        <Navbar sticky="top" bg="secondary" variant="dark" expand="md">
          <Container fluid>
            <Navbar.Brand href="/">
              Shoestring Scrap Monitoring
            </Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" className='mb-2' />
            <Navbar.Collapse id="basic-navbar-nav">
              <Nav variant="pills" className="me-auto">
                <BSNavLink to='/operations'>Operations</BSNavLink>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
        {/* </div> */}
        <Container fluid className="flex-grow-1 main-background px-1 pt-2 px-sm-2">
          <Row className="h-100 m-0 d-flex justify-content-center pt-4 pb-5">
            <Col md={10} lg={8}>
              <Outlet />
            </Col>
          </Row>
        </Container>
        <ToastContainer className="p-3" containerPosition={"fixed"} position={"bottom-end"}>
          <Toast className="p-1" bg={variant}>
            <strong>{text}</strong>
          </Toast>
        </ToastContainer>
      </Container>
    )
  }
}

function BSNavLink({ children, className, ...props }) {
  return <NavLink className={({ isActive }) => (isActive ? ("nav-link active " + className) : ("nav-link " + className))} {...props}>{children}</NavLink>
}

function OperationList({ operation_list, config }) {
  return <Container fluid="md">
    <Card className='mt-2'>
      <Card.Header className='text-center'><h1>{config?.location_page?.title}</h1></Card.Header>
      <Card.Body>
        <ListGroup>
          {operation_list.map(item => (
            <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-baseline">
              {item.name}
              <span className='flex-shrink-0'>
                <NavLink className="mx-2" to={"/single/" + item.id}>
                  <Button>Single</Button>
                </NavLink>
                <NavLink to={"/batch/" + item.id}>
                  <Button>Batch</Button>
                </NavLink>
              </span>
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Card.Body>
    </Card>
  </Container>
}

export default App;
