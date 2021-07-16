import { Brackets, Repository, SelectQueryBuilder, WhereExpression } from 'typeorm';

export abstract class MainRepository<T> extends Repository<T> {
  public async getOne(resourceOptions?: object) {
    const alias: string = this.generateAliasName();
    const queryBuilder = this.createQueryBuilder(alias);

    this.applyResourceOptions(alias, resourceOptions, queryBuilder);

    return queryBuilder.getOne();
  }

  public async getOneById(id: number, resourceOptions?: object) {
    const alias: string = this.generateAliasName();
    const queryBuilder = this.createQueryBuilder(alias);

    this.applyResourceOptions(alias, resourceOptions, queryBuilder);

    queryBuilder.andWhere(`${alias}.id = :id`, { id: id });

    return queryBuilder.getOne();
  }

  public async getManyAndCount(resourceOptions?: object) {
    const alias: string = this.generateAliasName();

    const queryBuilder = this.createQueryBuilder(alias);

    this.applyResourceOptions(alias, resourceOptions, queryBuilder);

    return {
      total_data: await queryBuilder.getCount(),
      rows: await queryBuilder.getMany(),
    };
  }

  public async getMany(resourceOptions?: object) {
    const alias: string = this.generateAliasName();

    const queryBuilder = this.createQueryBuilder(alias);

    this.applyResourceOptions(alias, resourceOptions, queryBuilder);

    return queryBuilder.getMany();
  }

  public applyResourceOptions(mainAlias: string, options: any, queryBuilder: SelectQueryBuilder<any>) {
    if (!options) {
      return;
    }

    if (options.order) {
      for (const [sort, order] of Object.entries(options.order)) {
        const sortSplited = sort.split(/\.(?=[^\.]+$)/);
        let whatToSort = '';

        if (!sort.includes('.')) {
          whatToSort = mainAlias + '.' + sort;
        } else {
          whatToSort = mainAlias + '__' + sortSplited[0].split('.').join('__') + '.' + sortSplited[1];
        }

        queryBuilder.addOrderBy(whatToSort, options.order[sort].order);
      }
    }

    if (options.take) {
      queryBuilder.take(options.take);
    }

    if (options.skip) {
      queryBuilder.skip(options.skip);
    }

    if (options.relations) {
      options.relations.forEach((relation: string) => {
        const splitedRelation = relation.split('.');
        let alias = '';
        let property = '';

        for (let index = 0; index < splitedRelation.length; index++) {
          property = index === 0 ? mainAlias + '.' + splitedRelation[index] : alias + '.' + splitedRelation[index];
          alias = index === 0 ? mainAlias + '__' + splitedRelation[index] : alias + '__' + splitedRelation[index];

          const scopeIndex = options.scopes.findIndex((scope: any) => {
            return alias == `${mainAlias + '__'}${scope.name.split('.').join('__')}`;
          });

          if (scopeIndex > -1) {
            return queryBuilder.leftJoinAndSelect(
              property,
              alias,
              options.scopes[scopeIndex].condition.replace('{alias}', alias),
              options.scopes[scopeIndex].parameters,
            );
          }

          queryBuilder.leftJoinAndSelect(property, alias);
        }
      });
    }

    if (options.filters && options.filters.length) {
      this.applyFilter(options.filters, options.filtersByOr, queryBuilder, mainAlias);
    }

    return queryBuilder;
  }

  public generateAliasName(): string {
    return this.metadata.tableNameWithoutPrefix;
  }

  public applyFilter(filters: any, filtersByOr: any, queryBuilder: SelectQueryBuilder<any>, alias: string) {
    queryBuilder.andWhere(
      new Brackets((qb1) => {
        this.buildFilters(qb1, filters, alias);

        if (filtersByOr | filtersByOr.length) {
          qb1.orWhere(
            new Brackets((qb2) => {
              this.buildFilters(qb2, filtersByOr, alias);
            }),
          );
        }
      }),
    );
  }

  public buildFilters(queryBuilder: SelectQueryBuilder<any> | WhereExpression, filters: any, alias: string) {
    for (let index = 0; index < filters.length; index++) {
      const element = filters[index];
      const not = element.not;
      const operator = element.operator;
      let value = element.value;
      let sqlOperator = '';
      let whatToFilter = '';
      let queryWhere = '';
      let queryParameters: any = {};
      let randomStr1 = String((Math.random() * 1e32).toString(36));
      let randomStr2 = String((Math.random() * 1e32).toString(36));
      let queryParameterName = String(`(:${randomStr1})`);

      if (!element.column.includes('.')) {
        whatToFilter = alias + '.' + element.column;
      } else {
        let elementSplited = element.column.split(/\.(?=[^\.]+$)/);
        whatToFilter = alias + '__' + elementSplited[0].split('.').join('__') + '.' + elementSplited[1];
      }

      // Operators
      switch (operator) {
        // String contains
        case 'ct':
          value = '%' + value + '%';
          sqlOperator = not ? 'NOT LIKE' : 'LIKE';
          break;

        // Equals
        case 'eq':
          value = value;
          sqlOperator = not ? 'NOT !=' : '=';
          break;

        // Starts with
        case 'sw':
          value = value + '%';
          sqlOperator = not ? 'NOT LIKE' : 'LIKE';
          break;

        // Ends with
        case 'ew':
          value = '%' + value;
          sqlOperator = not ? 'NOT LIKE' : 'LIKE';
          break;

        // Greater than
        case 'gt':
          sqlOperator = not ? '<' : '>';
          break;

        // Greater than or equalTo
        case 'gte':
          sqlOperator = not ? '<' : '>=';
          break;

        // Lesser than or equalTo
        case 'lte':
          sqlOperator = not ? '>' : '<=';
          break;

        // Lesser than
        case 'lt':
          sqlOperator = not ? '>' : '<';
          break;

        // In array
        case 'in':
          value = value.split(',');
          sqlOperator = not ? 'NOT IN' : 'IN';
          break;

        // Between
        case 'bt':
          const firstValue = value.split(',')[0];
          const secondValue = value.split(',')[1];
          queryParameterName = String(`:${randomStr1} AND :${randomStr2}`);
          queryParameters = { [String(randomStr1)]: firstValue, [String(randomStr2)]: secondValue };
          sqlOperator = not ? 'NOT BETWEEN' : 'BETWEEN';
          break;

        default:
          break;
      }

      if (Object.keys(queryParameters).length == 0) {
        queryParameters = { [String(randomStr1)]: value };
      }

      queryWhere = `${whatToFilter} ${sqlOperator} ` + queryParameterName;

      queryBuilder.andWhere(queryWhere, queryParameters);
    }
  }
}
