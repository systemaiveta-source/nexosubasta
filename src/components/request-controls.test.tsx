import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceRequestForm } from "./ServiceRequestForm";
import { DeliveryForm } from "./DeliveryForm";
import { CatalogSelect } from "./CatalogSelect";
afterEach(cleanup);
describe("controles de solicitudes y catálogos", () => {
  it("cambiar categoría elimina campos anteriores", () => {
    const change = vi.fn();
    render(<ServiceRequestForm value={{ category: "mechanics", subcategory: "Diagnóstico", values: { brand: "Marca", model: "Modelo" } }} onChange={change} />);
    fireEvent.change(screen.getByLabelText("Categoría de servicio"), { target: { value: "accounting" } });
    expect(change).toHaveBeenCalledWith({ category: "accounting", subcategory: "", values: {} });
  });
  it("cambiar envío pagado por retiro elimina sobrecosto", () => {
    const change = vi.fn();
    render(<DeliveryForm value={{ mode: "paid", cost: 10, conditions: "Entrega local" }} onChange={change} />);
    fireEvent.change(screen.getByLabelText("Modalidad de entrega"), { target: { value: "pickup" } });
    expect(change).toHaveBeenCalledWith({ mode: "pickup", cost: null, conditions: "Entrega local" });
  });
  it("buscar no cambia la moneda seleccionada ni convierte importes", () => {
    const change = vi.fn();
    render(<CatalogSelect kind="currency" label="Moneda" value="USD" onChange={change} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "cordoba" } });
    expect(screen.getByRole("combobox")).toHaveValue("USD");
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "NIO" } });
    expect(change).toHaveBeenCalledWith("NIO");
  });
});