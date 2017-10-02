import { Component } from '@angular/core';
import { IonicPage, NavParams, MenuController, Loading, LoadingController, AlertController} from 'ionic-angular';

import { VendedorService } from '../../providers/vendedor.service';
import { Network } from '@ionic-native/network';

declare var google;

@IonicPage()
@Component({
  selector: 'page-map',
  templateUrl: 'map.html',
})
export class MapPage {

  map: any;
  key: string;
  load: Loading;
  vendedor: any = {};
  myPosition: any = {};
  bounds: any = null;
  infowindow: any;
  fecha: string;
  markers: any[] = [];
  markerVendedor: any = null;
  geoList = {};
  linesPath: any = null;
  hora: string;

  indicadores = {
    venta: {
      count: 0,
      text: 'Venta',
      estado: true
    },
    ventaAnulada: {
      count: 0,
      text: 'Venta Anulada',
      estado: true
    },
    pedido: {
      count: 0,
      text: 'Pedido',
      estado: true
    },
    pedidoAnulado: {
      count: 0,
      text: 'Pedido Anulado',
      estado: true
    },
    visita: {
      count: 0,
      text: 'Visita',
      estado: true
    },
    devolucion: {
      count: 0,
      text: 'Devolucion',
      estado: true
    }
  };

  constructor(
    private navParams: NavParams,
    private loadCtrl: LoadingController,
    private vendedorService: VendedorService,
    private menuCtrl: MenuController,
    private alertCtrl: AlertController,
    private network: Network
  ) {
    this.key = this.navParams.get('key');
    this.bounds = new google.maps.LatLngBounds();
    this.infowindow = new google.maps.InfoWindow();
  }

  ionViewDidLoad() {
    this.vendedorService.getFechaServidor()
    .subscribe(data => {
      this.fecha = data.fecha;
      console.log(this.fecha);
    });

    this.load = this.loadCtrl.create({
      content: 'Cargando...'
    });
    this.load.present();
    this.verificarConexion();
    this.loadMap();
  }

  ionViewDidEnter() {
    this.menuCtrl.enable(false, 'menuAdmin');
  }

  private verificarConexion() {
    if (this.network.type === 'none') {
      console.log(this.network.type);
      const alert = this.alertCtrl.create({
        title: 'Sin conexión',
        subTitle: 'Mapa sin conexion',
        buttons: ['OK']
      });
      alert.present();
      this.load.dismiss();
    }
  }

  private loadMap() {
    // create a new map by passing HTMLElement
    const mapEle: HTMLElement = document.getElementById('map');

    const latitud = -17.2378799;
    const longitud = -66.7239997;

    // create LatLng object
    const myLatLng = { lat: latitud, lng: longitud };
    // create map
    this.map = new google.maps.Map(mapEle, {
      center: myLatLng,
      zoom: 12
    });

    google.maps.event.addListenerOnce(this.map, 'idle', () => {
      mapEle.classList.add('show-map');
      this.obtenerVendedor();
    });
  }

  private obtenerVendedor() {
    this.vendedorService.getVendedor(this.key)
    .subscribe((vendedor) => {
      this.vendedor = vendedor;
      console.log('getVendedor', this.vendedor);
      const latitud = this.vendedor.PosicionActual.latitud;
      const longitud = this.vendedor.PosicionActual.longitud;
      const newCenter = new google.maps.LatLng(latitud, longitud);
      this.map.setCenter(newCenter);
      const icon = './assets/imgs/vendedor.png';

      // si el marker no esta creado crea un marker pero si ya esta creado modifica la posicion
      if (this.markerVendedor === null) {
        this.markerVendedor = this.createMarker(latitud, longitud, icon, this.vendedor.nombreVendedor, '', '');
      }else {
        this.markerVendedor.setPosition(newCenter);
      }
      // Coloca todos los contadores en cero
      this.resetCounts();
      // obtiene el registro de acuerdo a la fecha
      this.getRegister();
      this.load.dismiss();
    });
  }

  // obtener el registro del vendedor
  private getRegister() {
    if (this.vendedor[`registro:${this.fecha}`] === undefined) {
      const alert = this.alertCtrl.create({
        subTitle: 'Sin Registro Actual ',
        buttons: ['OK']
      });
      alert.present();
    }else {
      const geoPuntosList = this.vendedor[`registro:${this.fecha}`].geoPuntoList;
      this.renderMarkers(geoPuntosList);
    }
  }

  private renderMarkers(geoPuntosList: any) {
    const lines = [];
    for (const key in geoPuntosList) {
      // verifica si el punto ya esta creado dentro en this.geoList si ya esta lo actualiza, si no esta lo crea
      if (this.geoList.hasOwnProperty(key)) {
        const updatePoint = geoPuntosList[key];
        this.updatePoint(key, updatePoint);
        lines.push({ lat: updatePoint.latitud, lng: updatePoint.longitud });
      }else {
        const newPoint = geoPuntosList[key];
        this.createPoint(key, newPoint);
        lines.push({ lat: newPoint.latitud, lng: newPoint.longitud });
        this.hora = newPoint.hora;
      }
    }
    this.createLines(lines);
  }

  // crea un marker para ese punto
  private createPoint(key: string, point: any) {
    // crear objeto
    this.geoList[key] = {};
    // crear punto
    this.geoList[key].point = Object.assign({}, point);
    // obtengo el tipo correcto
    const type = this.getType(point);
    this.indicadoresList(type);
    this.geoList[key].point.tipo = type;
    // obtengo el icono correcto de acuerdo al tipo
    const icon = this.getIcon(type);
    // crear el marker de este punto
    if (icon !== '') {
      this.geoList[key].marker = this.createMarker(
        point.latitud,
        point.longitud,
        icon,
        point.nombreCliente,
        point.clienteId,
        point.hora
      );
    }
  }

  // actualiza la informacion sin tener que crear un marker
  private updatePoint(key: string, point: any) {
    this.geoList[key].point = Object.assign({}, point);
    // obtengo el tipo correcto
    const type = this.getType(point);
    this.geoList[key].point.tipo = type;
    // obtengo el icono correcto de acuerdo al tipo
    const icon = this.getIcon(type);
    // modifica la posicion del marker
    this.geoList[key].marker.setPosition({
      lat: point.latitud,
      lng: point.longitud
    });
    // modifica icono
    this.geoList[key].marker.setIcon(icon);
  }

  private indicadoresList(type) {
    if (type === 'PEDIDO') {
      this.indicadores.pedido.count++;
    }else if (type === 'VISITA') {
      this.indicadores.visita.count++;
    }else if (type === 'VENTA') {
      this.indicadores.venta.count++;
    }else if (type === 'DEVOLUCION') {
      this.indicadores.devolucion.count++;
    }else if (type === 'PEDIDO_ANULADO') {
      this.indicadores.pedidoAnulado.count++;
    }else if (type === 'VENTA_ANULADA') {
      this.indicadores.ventaAnulada.count++;
    }
  }

  // retorna el icono indicado de acuerdo al tipo
  private getIcon(tipo: string) {
    switch (tipo) {
      case 'VENTA': {
        return './assets/imgs/venta.png';

      }case 'VISITA': {
        return './assets/imgs/visita.png';
      }
      case 'PEDIDO': {
        return './assets/imgs/pedido.png';
      }
      case 'DEVOLUCION': {
        return './assets/imgs/devolucion.png';
      }
      case 'PEDIDO_ANULADO': {
        return './assets/imgs/pedidoAnulado.png';
      }
      case 'VENTA_ANULADA': {
        return './assets/imgs/ventaAnulada.png';
      }
      default: {
        return '';
      }
    }
  }

  // retorna el tipo adeacuado segun la informacion
  private getType(point: any) {
    if (point.tipo === 'PEDIDO' && point.estadoPV === 'ANULADO') {
      return 'PEDIDO_ANULADO';
    }else if (point.tipo === 'VENTA' && point.estadoPV === 'ANULADO') {
      return 'VENTA_ANULADA';
    }else {
      return point.tipo;
    }
  }

  private createLines(lines: any[]) {
    // si ya hay unas lineas creadas las elimina antes de crear las nuevas
    if (this.linesPath !== null) {
      this.linesPath.setMap(null);
    }
    console.log(lines);
    this.linesPath = new google.maps.Polyline({
      path: lines,
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 2
    });
    this.linesPath.setMap(this.map);
  }

  private createMarker(lat: number, lng: number, icon: string, nombre: string, id: string, hora: string) {
    const options = {
      position: {
        lat: lat,
        lng: lng
      },
      title: nombre,
      map: this.map,
      icon: icon,
      zIndex: Math.round(lat * -100000)
    };
    const marker = new google.maps.Marker(options);
    const contentString = '<div>' +
                        '<div>CLIENTE: <b>' + nombre + '</b> </div>' +
                        '<div> CODIGO: <b> ' + id + ' </b></div>' +
                        '<p> HORA: <b> ' + hora + ' </b></p>' +
                        '</div>';
      marker.addListener('click', () => {
      this.infowindow.setContent(contentString);
      this.infowindow.open(this.map, marker);
    });
    return marker;
  }


  toggleVenta() {
    // Si el estado esta en true lo vuele false y si esta en false lo vuelve true
    this.indicadores.venta.estado = !this.indicadores.venta.estado;
    this.ocultarPuntos();
  }

  togglePedido() {
    this.indicadores.pedido.estado = !this.indicadores.pedido.estado;
    this.ocultarPuntos();
  }

  toggleVisita() {
    this.indicadores.visita.estado = !this.indicadores.visita.estado;
    this.ocultarPuntos();
  }

  toggleVentaAnulada() {
    this.indicadores.ventaAnulada.estado = !this.indicadores.ventaAnulada.estado;
    this.ocultarPuntos();
  }

  togglePedidoAnulado() {
    this.indicadores.pedidoAnulado.estado = !this.indicadores.pedidoAnulado.estado;
    this.ocultarPuntos();
  }

  toggleDevolucion() {
    this.indicadores.devolucion.estado = !this.indicadores.devolucion.estado;
    this.ocultarPuntos();
  }

  ocultarPuntos() {
    // recorrer la lista de points
    for (const key in this.geoList) {
      // verifica si el punto existe dentro de this.geoList
      if (this.geoList.hasOwnProperty(key)) {
        const item = this.geoList[key];
        // item.marker.setVisible(true);
        if (this.indicadores.venta.estado === false && item.point.tipo === 'VENTA') {
          item.marker.setVisible(false);
        }else if (this.indicadores.venta.estado === true && item.point.tipo === 'VENTA') {
          item.marker.setVisible(true);
        }

        if (this.indicadores.pedido.estado === false && item.point.tipo === 'PEDIDO' ) {
          item.marker.setVisible(false);
        }else if (this.indicadores.pedido.estado === true && item.point.tipo === 'PEDIDO') {
          item.marker.setVisible(true);
        }

        if (this.indicadores.visita.estado === false && item.point.tipo === 'VISITA' ) {
          item.marker.setVisible(false);
        }else if (this.indicadores.visita.estado === true && item.point.tipo === 'VISITA') {
          item.marker.setVisible(true);
        }

        if (this.indicadores.ventaAnulada.estado === false && item.point.tipo === 'VENTA_ANULADA' ) {
          item.marker.setVisible(false);
        }else if (this.indicadores.ventaAnulada.estado === true && item.point.tipo === 'VENTA_ANULADA') {
          item.marker.setVisible(true);
        }

        if (this.indicadores.pedidoAnulado.estado === false && item.point.tipo === 'PEDIDO_ANULADO' ) {
          item.marker.setVisible(false);
        }else if (this.indicadores.pedidoAnulado.estado === true && item.point.tipo === 'PEDIDO_ANULADO') {
          item.marker.setVisible(true);
        }

        if (this.indicadores.devolucion.estado === false && item.point.tipo === 'DEVOLUCION' ) {
          item.marker.setVisible(false);
        }else if (this.indicadores.devolucion.estado === true && item.point.tipo === 'DEVOLUCION') {
          item.marker.setVisible(true);
        }
      }
    }
  }

  private resetCounts() {
    this.indicadores.devolucion.count = 0;
    this.indicadores.pedido.count = 0;
    this.indicadores.pedidoAnulado.count = 0;
    this.indicadores.venta.count = 0;
    this.indicadores.ventaAnulada.count = 0;
    this.indicadores.visita.count = 0;
  }
}
