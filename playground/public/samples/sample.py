"""A small module, to show syntax colours."""
from dataclasses import dataclass


@dataclass
class Order:
    units: int
    unit_price: float
    discount: float = 0.0

    @property
    def total(self) -> float:
        return round(self.units * self.unit_price * (1 - self.discount), 2)


def summarise(orders: list[Order]) -> dict[str, float]:
    # Totals are rounded per order, as on the invoice.
    totals = [order.total for order in orders]
    return {"count": len(totals), "revenue": sum(totals), "largest": max(totals, default=0)}


if __name__ == "__main__":
    print(summarise([Order(3, 19.99), Order(10, 4.5, discount=0.1)]))
