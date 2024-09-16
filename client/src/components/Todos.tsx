import dateFormat from 'dateformat'
import { History } from 'history'
import update from 'immutability-helper'
import React, { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Divider,
  Grid,
  Header,
  Icon,
  Input,
  Image,
  Loader,
  TextArea
} from 'semantic-ui-react'

import {
  createTodo,
  deleteTodo,
  getTodos,
  patchTodo,
  patchTodoNote
} from '../api/todos-api'
import Auth from '../auth/Auth'
import { Todo } from '../types/Todo'

interface TodosProps {
  auth: Auth
  history: History
}

interface TodosState {
  todos: Todo[]
  newTodoName: string
  loadingTodos: boolean
}

export const Todos = (props: TodosProps) => {
  useEffect(() => {
    fetchTodos()
  }, [props])

  const fetchTodos = async () => {
    try {
      const todos = await getTodos(props.auth.getIdToken())
      setState({
        ...state,
        todos,
        loadingTodos: false
      })
    } catch (e) {
      alert(`Failed to fetch todos: ${(e as Error).message}`)
    }
  }

  const [state, setState] = useState<TodosState>({
    todos: [],
    newTodoName: '',
    loadingTodos: false
  })

  const [hoverTodo, setHoverTodo] = useState<String | undefined>(undefined)
  const [todoObj, setTodoObj] = useState<any>({})
  const [updateObj, setUpdateObj] = useState<any>()
  const [noteUpdate, setNoteUpdate] = useState<
    { todoId: string; note: string } | undefined
  >(undefined)

  useEffect(() => {
    if (!updateObj) return
    const timer = setTimeout(async () => {
      debounceUpdateTodo(updateObj)
    }, 1500)
    return () => clearTimeout(timer)
  }, [updateObj])

  useEffect(() => {
    if (!noteUpdate || !noteUpdate?.todoId) return
    const timer = setTimeout(async () => {
      debounceUpdateTodoNote(noteUpdate)
    }, 1500)
    return () => clearTimeout(timer)
  }, [noteUpdate])

  useEffect(() => {
    if (!state.todos?.length) {
      return
    }
    const todoArrToObj = {} as any
    state.todos.forEach((t) => {
      todoArrToObj[t.todoId] = t
    })
    setTodoObj(todoArrToObj)
  }, [state.todos])

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({ ...state, newTodoName: event.target.value })
  }

  const onEditButtonClick = (todoId: string) => {
    props.history.push(`/todos/${todoId}/edit`)
  }

  const onTodoCreate = async (event: React.ChangeEvent<HTMLButtonElement>) => {
    try {
      const dueDate = calculateDueDate()
      const newTodo = await createTodo(props.auth.getIdToken(), {
        name: state.newTodoName,
        dueDate,
        note: ''
      })
      setState({
        ...state,
        todos: [...state.todos, newTodo],
        newTodoName: ''
      })
    } catch {
      alert('Todo creation failed')
    }
  }

  const onTodoDelete = async (todoId: string) => {
    try {
      await deleteTodo(props.auth.getIdToken(), todoId)
      setState({
        ...state,
        todos: state.todos.filter((todo) => todo.todoId !== todoId)
      })
    } catch {
      alert('Todo deletion failed')
    }
  }

  const onTodoCheck = async (pos: number) => {
    try {
      const todo = state.todos[pos]
      await patchTodo(props.auth.getIdToken(), todo.todoId, {
        name: todo.name,
        dueDate: todo.dueDate,
        done: !todo.done
      })
      setState({
        ...state,
        todos: update(state.todos, {
          [pos]: { done: { $set: !todo.done } }
        })
      })
    } catch {
      alert('Todo deletion failed')
    }
  }
  const calculateDueDate = (): string => {
    const date = new Date()
    date.setDate(date.getDate() + 7)

    return dateFormat(date, 'yyyy-mm-dd') as string
  }
  const renderCreateTodoInput = () => {
    return (
      <Grid.Row>
        <Grid.Column width={16}>
          <Input
            action={{
              color: 'teal',
              labelPosition: 'left',
              icon: 'add',
              content: 'New task',
              onClick: onTodoCreate
            }}
            fluid
            actionPosition="left"
            placeholder="To change the world..."
            onChange={handleNameChange}
          />
        </Grid.Column>
        <Grid.Column width={16}>
          <Divider />
        </Grid.Column>
      </Grid.Row>
    )
  }
  const renderTodos = () => {
    if (state.loadingTodos) {
      return renderLoading()
    }

    return renderTodosList()
  }

  const renderLoading = () => {
    return (
      <Grid.Row>
        <Loader indeterminate active inline="centered">
          Loading TODOs
        </Loader>
      </Grid.Row>
    )
  }

  const onChangeValue = (data: { value: string; id: string; key: string }) => {
    const { value, id, key } = data
    const todo = { ...todoObj[id] }
    if (!todo) return
    todo[key] = value
    const newTodoObj = { ...todoObj, [id]: todo }
    setTodoObj(newTodoObj)
    setUpdateObj(todo)
  }

  const onChangeNote = (value: string, id: string) => {
    const todo = { ...todoObj[id] }
    todo['note'] = value
    const newTodoObj = { ...todoObj, [id]: todo }
    setTodoObj(newTodoObj)
    setNoteUpdate(todo)
  }

  const debounceUpdateTodo = useCallback(async (todo: any) => {
    await patchTodo(props.auth.getIdToken(), todo.todoId, {
      name: todo.name,
      dueDate: todo.dueDate,
      done: todo.done,
      note: todo.note
    })
  }, [])

  const debounceUpdateTodoNote = useCallback(async (todo: any) => {
    await patchTodoNote(props.auth.getIdToken(), todo.todoId, todo.note || '')
  }, [])

  const onBlurTodo = (id: string) => {
    setHoverTodo('')

    const todos = state.todos.map((t) => {
      if (t.todoId === id && todoObj[id]) {
        t.name = todoObj[id].name
      }
      return t
    })
    setState({ ...state, todos })
  }

  const renderTodosList = () => {
    return (
      <Grid padded>
        {state.todos.map((todo, pos) => {
          return (
            <Grid.Row key={todo.todoId}>
              <Grid.Column width={1} verticalAlign="middle">
                <Checkbox
                  onChange={() => onTodoCheck(pos)}
                  checked={todo.done}
                />
              </Grid.Column>
              <Grid.Column width={10} verticalAlign="middle">
                <div
                  onMouseEnter={() => {
                    setHoverTodo(todo.todoId)
                  }}
                  onMouseLeave={() => onBlurTodo(todo.todoId)}
                >
                  {hoverTodo === todo.todoId || !todoObj[todo.todoId]?.name ? (
                    <MyInput
                      error={
                        !todoObj[todo.todoId]?.name
                          ? "Please enter todo's name"
                          : ''
                      }
                      onChange={(value: string) => {
                        onChangeValue({ value, id: todo.todoId, key: 'name' })
                      }}
                      defaultValue={todoObj[todo.todoId]?.name}
                    />
                  ) : (
                    todoObj[todo.todoId]?.name || todo.name
                  )}
                </div>
              </Grid.Column>
              <Grid.Column width={3} floated="right">
                {todo.dueDate}
              </Grid.Column>
              <Grid.Column width={1} floated="right">
                <Button
                  icon
                  color="blue"
                  onClick={() => onEditButtonClick(todo.todoId)}
                >
                  <Icon name="pencil" />
                </Button>
              </Grid.Column>
              <Grid.Column width={1} floated="right">
                <Button
                  icon
                  color="red"
                  onClick={() => onTodoDelete(todo.todoId)}
                >
                  <Icon name="delete" />
                </Button>
              </Grid.Column>
              {!!todo.attachmentUrl && (
                <Image src={todo.attachmentUrl} size="small" wrapped />
              )}
              <MyTextArea
                defaultValue={todo.note}
                onChange={(value: string) => onChangeNote(value, todo.todoId)}
              />
              <Grid.Column width={16}>
                <Divider />
              </Grid.Column>
            </Grid.Row>
          )
        })}
      </Grid>
    )
  }
  return (
    <div>
      <Header as="h1">TODOs</Header>

      {renderCreateTodoInput()}

      {renderTodos()}
    </div>
  )
}

export const MyInput = (props: {
  onChange?: Function
  defaultValue?: string
  error?: string
}) => {
  return (
    <div>
      <Input
        error={!!props.error}
        placehoder="enter your todo name here..."
        onChange={(e) => props.onChange && props.onChange(e.target.value)}
        defaultValue={props.defaultValue}
      />
      {props.error && <>{props.error}</>}
    </div>
  )
}

export const MyTextArea = (props: {
  onChange?: Function
  defaultValue?: string
  rows?: number
}) => {
  return (
    <div style={{ marginTop: '20px', marginLeft: '30px' }}>
      <TextArea
        onChange={(e) => props.onChange && props.onChange(e.target.value)}
        rows={props.rows || 3}
        defaultValue={props.defaultValue || ''}
        placeholder="enter your content"
      />
    </div>
  )
}
