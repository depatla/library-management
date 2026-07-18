"""Shared pagination for list endpoints: `Page[T]` response + `PageParams` dependency."""

from typing import Annotated, Generic, TypeVar

from fastapi import Depends, Query
from pydantic import BaseModel

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = 1
    page_size: int = 20

    @property
    def limit(self) -> int:
        return self.page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


PageQuery = Annotated[PageParams, Depends(page_params)]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


def make_page(items: list[T], total: int, params: PageParams) -> Page[T]:
    total_pages = (total + params.page_size - 1) // params.page_size if total else 0
    return Page(items=items, total=total, page=params.page, page_size=params.page_size, total_pages=total_pages)
