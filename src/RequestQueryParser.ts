import { isEmpty } from 'class-validator';

export class RequestQueryParser {
  public limit: number | undefined;
  public page: number | undefined;
  public sortByDesc: any;
  public sortByAsc: any;
  public relations: any;
  public filter: any;
  public filterByOr: any;

  parseLimit(): number {
    return Number(this.limit);
  }

  getPage(): number {
    return Number(this.page);
  }

  parseSort(): object {
    if (isEmpty(this.sortByDesc) && isEmpty(this.sortByAsc)) {
      return [];
    }

    const list: any = {};

    if (!isEmpty(this.sortByDesc)) {
      const sortByDesc = this.sortByDesc.split(',');

      sortByDesc.forEach((field: string) => {
        list[field] = 'DESC';
      });
    }

    if (!isEmpty(this.sortByAsc)) {
      const sortByAsc = this.sortByAsc.split(',');

      sortByAsc.forEach((field: string) => {
        list[field] = 'ASC';
      });
    }

    return list;
  }

  parseRelations(): string[] {
    if (isEmpty(this.relations) && isEmpty(this.relations)) {
      return [];
    }

    return this.relations.split(',');
  }

  parseFilters(or: boolean = false): object[] {
    const filters = or ? this.filterByOr : this.filter;

    const parsedFilters: any = [];

    for (const filter in filters) {
      const myObj = filters[filter];
      let value: any = null;
      let operator: string = 'eq';
      let not: boolean = false;

      if (typeof myObj === 'string' || myObj instanceof String) {
        value = myObj;
      }

      if (typeof myObj === 'object') {
        operator = Object.keys(myObj)[0];
        value = myObj[operator];
        if (typeof value === 'string' || value instanceof String) {
          value = value;
        } else {
          operator = Object.keys(myObj)[0];
          const operatorValues = myObj[operator];
          const isNot = Object.keys(operatorValues)[0];
          not = Boolean(isNot);
          value = operatorValues[isNot];
        }
      }

      parsedFilters.push({ column: filter, operator: operator, not: not, value: value });
    }

    return parsedFilters;
  }

  parseFiltersByOr(): object[] {
    return this.parseFilters(true);
  }

  getAll(): {
    take: number;
    skip: number;
    order: object;
    relations: string[];
    filters: object[];
    filtersByOr: object[];
  } {
    return {
      take: this.parseLimit(),
      skip: (this.getPage() > 0 ? this.getPage() - 1 : 0) * this.parseLimit(),
      order: this.parseSort(),
      relations: this.parseRelations(),
      filters: this.parseFilters(),
      filtersByOr: this.parseFiltersByOr(),
    };
  }
}
