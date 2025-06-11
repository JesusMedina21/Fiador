import { Cliente } from "./cliente.model";

// Interfaz para el detalle del producto dentro de un fiado
export interface DetalleFiadoProducto {
    producto_id: number;
    producto_nombre: string;
    precio: number;
    cantidad: number;
}

export interface Fiado {
    id: number,
    cliente: Cliente;
    //Relacion con la interfaz o modelo cliente
    cliente_nombre: string,
    monto_total: number,
    abono: number;
    deuda_total: number,
    interes: number,
    fecha_registro: string,
    productos?: DetalleFiadoProducto[];
    deuda_pendiente?: DetalleFiadoProducto[];
}

